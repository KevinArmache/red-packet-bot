"use server";

import {
  addMonitoredAccount,
  addRedPacketCode,
  addScrapeLog,
  getCodeById,
  getFailedClaimAttemptsLast24Hours,
  getMonitoredAccounts,
  getRedPacketCodes,
  getScrapeLogs,
  getSetting,
  recordClaimAttempt,
  removeMonitoredAccount,
  setSetting,
  updateCodeStatus,
  cleanupOldCodes,
  deleteRedPacketCode,
  deleteAllRedPacketCodes,
} from "@/lib/db";

import { extractRedPacketCodes, scrapeAccounts } from "@/lib/scraper";
import { claimBinanceRedPacketPlaywright } from "@/lib/playwright-binance";
import { revalidatePath } from "next/cache";

// Account management
export async function getAccounts() {
  return getMonitoredAccounts();
}

export async function addAccount(formData) {
  const username = formData.get("username");
  if (!username) {
    return { success: false, error: "Username is required" };
  }

  const cleanUsername = username.trim().toLowerCase().replace("@", "");
  if (!cleanUsername) {
    return { success: false, error: "Invalid username" };
  }

  const result = addMonitoredAccount(cleanUsername);
  if (!result) {
    return { success: false, error: "Account already exists" };
  }

  addScrapeLog("info", `Added account: @${cleanUsername}`);
  revalidatePath("/settings");
  return { success: true, account: result };
}

export async function removeAccount(id) {
  const result = removeMonitoredAccount(id);
  if (result) {
    addScrapeLog("info", `Removed account id: ${id}`);
    revalidatePath("/settings");
  }
  return { success: result };
}

// Red packet codes
export async function getCodes() {
  return getRedPacketCodes();
}



export async function claimCode(id) {
  const code = getCodeById(id);
  if (!code) {
    return { success: false, error: "Code not found" };
  }

  if (code.status === "claimed") {
    return { success: false, error: "Already claimed" };
  }

  addScrapeLog("info", `Claiming via Playwright: ${code.code}`);
  
  // Utilisation de Playwright au lieu de l'API Binance
  const result = await claimBinanceRedPacketPlaywright(code.code);

  if (result.success) {
    updateCodeStatus(
      id,
      "claimed",
      "Claimed via Playwright",
      result.token,
      parseFloat(result.amount) || 0,
    );
    recordClaimAttempt(id, true);
    addScrapeLog("info", `Claimed ${result.amount} ${result.token}`);
    revalidatePath("/");
    return {
      success: true,
      token: result.token,
      amount: result.amount,
    };
  }

  recordClaimAttempt(id, false, result.error);
  
  if (result.reason === "empty") {
    updateCodeStatus(id, "empty", "Déjà utilisé");
  } else if (result.reason === "expired") {
    updateCodeStatus(id, "expired");
  } else if (result.reason === "invalid") {
    updateCodeStatus(id, "invalid", result.error);
  } else {
    updateCodeStatus(id, "failed", result.error);
  }

  addScrapeLog("warn", `Claim failed: ${result.error}`);
  revalidatePath("/");
  return {
    success: false,
    error: result.error || "Erreur inconnue avec Playwright",
  };
}

export async function deleteCode(id) {
  const success = deleteRedPacketCode(id);
  if (success) {
    revalidatePath("/");
  }
  return { success };
}

export async function deleteAllCodes() {
  const count = deleteAllRedPacketCodes();
  if (count > 0) {
    addScrapeLog("info", `Tous les codes (${count}) ont été supprimés`);
    revalidatePath("/");
  }
  return { success: true, count };
}

export async function runCronWorkflow() {
  addScrapeLog("info", "Démarrage du Cron Workflow");
  
  // 1. Scrape
  await scrapeAccounts();
  
  // 2. Cleanup
  const deletedCount = cleanupOldCodes();
  if (deletedCount > 0) {
    addScrapeLog("info", `Nettoyage: ${deletedCount} codes supprimés`);
  }
  
  // 3. (Optional) Le "Claim All" séquentiel est mieux géré côté client pour éviter le timeout du serveur.
  // Ce workflow sert surtout à mettre à jour la BDD périodiquement.
  
  revalidatePath("/");
  return { success: true };
}

export async function getFailedAttemptsCount() {
  return getFailedClaimAttemptsLast24Hours();
}

// Settings
export async function getSettings() {
  return {
    scrapingEnabled: getSetting("scraping_enabled") === "true",
    scrapeIntervalMinutes: parseInt(
      getSetting("scrape_interval_minutes") || "5",
      10,
    ),
    testMode: getSetting("test_mode") === "true",
  };
}

export async function updateSettings(formData) {
  const scrapingEnabled = formData.get("scraping_enabled") === "true";
  const scrapeIntervalMinutes = formData.get("scrape_interval_minutes");
  const testMode = formData.get("test_mode") === "true";

  setSetting("scraping_enabled", scrapingEnabled.toString());
  if (scrapeIntervalMinutes) {
    setSetting("scrape_interval_minutes", scrapeIntervalMinutes);
  }
  setSetting("test_mode", testMode.toString());

  addScrapeLog("info", "Settings updated");
  revalidatePath("/settings");
  return { success: true };
}

// Manual scrape
export async function triggerScrape() {
  addScrapeLog("info", "Manual scrape triggered");
  const result = await scrapeAccounts();
  revalidatePath("/");
  revalidatePath("/settings");
  return result;
}

// Manual code ingestion
export async function ingestCode(formData) {
  const text = formData.get("text");
  const author = formData.get("author") || "manual";

  if (!text) {
    return { success: false, error: "Text is required" };
  }

  const codes = extractRedPacketCodes(text);
  if (codes.length === 0) {
    return {
      success: false,
      error: "No valid codes found (format: BP + alphanumeric)",
    };
  }

  let addedCount = 0;
  for (const code of codes) {
    const result = addRedPacketCode(code, text, null, author);
    if (result) {
      addedCount++;
      addScrapeLog("info", `Manually added: ${code}`);
    }
  }

  revalidatePath("/");
  return {
    success: true,
    codesFound: codes.length,
    codesAdded: addedCount,
  };
}

// Logs
export async function getLogs(limit = 100) {
  return getScrapeLogs(limit);
}
