"use server";

import {
  addMonitoredAccount,
  addRedPacketCode,
  addScrapeLog,
  getCodeById,
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
import { claimBinanceRedPacketPlaywright, closeBrowser } from "@/lib/playwright-binance";
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

export async function autoClaimPendingCodes() {
  const codes = getRedPacketCodes().filter(c => c.status === "pending");
  if (codes.length === 0) {
    addScrapeLog("info", "[Auto-Claim] Aucun code en attente à réclamer.");
    return;
  }

  addScrapeLog("info", `[Auto-Claim] Démarrage du claim automatique pour ${codes.length} code(s) en attente.`);

  for (let i = 0; i < codes.length; i++) {
    const codeObj = codes[i];
    
    // Pause humaine aléatoire entre les claims (ex: entre 7 et 15 secondes)
    if (i > 0) {
      const delay = Math.floor(Math.random() * (15000 - 7000 + 1)) + 7000;
      addScrapeLog("info", `[Auto-Claim] Pause humaine de ${Math.round(delay / 1000)}s avant le code suivant...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      addScrapeLog("info", `[Auto-Claim] Tentative automatique pour le code: ${codeObj.code}`);
      
      const result = await claimCode(codeObj.id);
      
      if (result.success) {
        addScrapeLog("info", `[Auto-Claim] ✅ Récupéré : ${codeObj.code} (${result.amount} ${result.token})`);
      } else {
        addScrapeLog("warn", `[Auto-Claim] ❌ Échec pour ${codeObj.code}: ${result.error}`);
      }
    } catch (err) {
      addScrapeLog("error", `[Auto-Claim] Erreur lors de la réclamation de ${codeObj.code}: ${err.message}`);
    }
  }

  // Fermer le navigateur global après avoir fini tous les claims
  try {
    await closeBrowser();
  } catch (e) {}

  addScrapeLog("info", "[Auto-Claim] Fin de la session de claim automatique.");
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
  
  // 3. Réclamation automatique de tous les nouveaux codes trouvés
  // Nous l'exécutons de manière asynchrone (sans bloquer/attendre l'action cron principale si elle est lancée via UI,
  // ou avec await si c'est exécuté dans une tâche de fond locale)
  // Pour plus de robustesse sur un workflow de fond local, nous l'attendons.
  await autoClaimPendingCodes();
  
  revalidatePath("/");
  return { success: true };
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
    maxCodeAgeMinutes: parseInt(
      getSetting("max_code_age_minutes") || "30",
      10,
    ),
  };
}

export async function updateSettings(formData) {
  const scrapingEnabled = formData.get("scraping_enabled") === "true";
  const scrapeIntervalMinutes = formData.get("scrape_interval_minutes");
  const testMode = formData.get("test_mode") === "true";
  const maxCodeAgeMinutes = formData.get("max_code_age_minutes");

  setSetting("scraping_enabled", scrapingEnabled.toString());
  if (scrapeIntervalMinutes) {
    setSetting("scrape_interval_minutes", scrapeIntervalMinutes);
  }
  setSetting("test_mode", testMode.toString());
  if (maxCodeAgeMinutes) {
    setSetting("max_code_age_minutes", maxCodeAgeMinutes);
  }

  addScrapeLog("info", "Settings updated");
  revalidatePath("/settings");
  return { success: true };
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

export async function toggleScraping(enabled) {
  setSetting("scraping_enabled", enabled.toString());
  addScrapeLog("info", `Scraping automatique ${enabled ? "activé" : "désactivé"}`);
  revalidatePath("/");
  revalidatePath("/settings");
  return { success: true };
}
