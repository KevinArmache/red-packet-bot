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
} from "@/lib/db";
import { getErrorMessage, redeemGiftCard, verifyGiftCard } from "@/lib/binance";
import { extractRedPacketCodes, scrapeAccounts } from "@/lib/scraper";
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

export async function verifyCode(id) {
  const code = getCodeById(id);
  if (!code) {
    return { success: false, error: "Code not found" };
  }

  addScrapeLog("info", `Verifying code: ${code.code}`);
  const result = await verifyGiftCard(code.code);

  if (result.success && result.data) {
    const newStatus = result.data.valid ? "valid" : "invalid";
    updateCodeStatus(id, newStatus);
    addScrapeLog("info", `Code ${code.code} is ${newStatus}`);
    revalidatePath("/");
    return {
      success: true,
      valid: result.data.valid,
      token: result.data.token,
      amount: result.data.amount,
    };
  }

  addScrapeLog("warn", `Verify failed: ${result.error}`);
  return {
    success: false,
    error: result.error || "Verification failed",
    errorCode: result.code,
  };
}

export async function claimCode(id) {
  const failedAttempts = getFailedClaimAttemptsLast24Hours();
  if (failedAttempts >= 5) {
    return {
      success: false,
      error: "Daily limit reached (5 failed attempts). Try again in 24h.",
      blocked: true,
    };
  }

  const code = getCodeById(id);
  if (!code) {
    return { success: false, error: "Code not found" };
  }

  if (code.status === "claimed") {
    return { success: false, error: "Already claimed" };
  }

  addScrapeLog("info", `Claiming: ${code.code}`);
  const result = await redeemGiftCard(code.code);

  if (result.success && result.data) {
    updateCodeStatus(
      id,
      "claimed",
      JSON.stringify(result.data),
      result.data.token,
      parseFloat(result.data.amount),
    );
    recordClaimAttempt(id, true);
    addScrapeLog("info", `Claimed ${result.data.amount} ${result.data.token}`);
    revalidatePath("/");
    return {
      success: true,
      token: result.data.token,
      amount: result.data.amount,
    };
  }

  recordClaimAttempt(id, false, result.error);
  const friendlyError = getErrorMessage(result.code);

  if (result.code === "000003") {
    updateCodeStatus(id, "claimed", "Already redeemed");
  } else if (result.code === "000004") {
    updateCodeStatus(id, "expired");
  } else {
    updateCodeStatus(id, "failed", result.error);
  }

  addScrapeLog("warn", `Claim failed: ${friendlyError}`);
  revalidatePath("/");
  return {
    success: false,
    error: friendlyError,
    errorCode: result.code,
  };
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
