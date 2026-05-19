"use server";

import {
  addMonitoredAccount,
  addScrapeLog,
  getMonitoredAccounts,
  getRedPacketCodes,
  getScrapeLogs,
  getSetting,
  removeMonitoredAccount,
  setSetting,
  cleanupOldCodes,
  deleteRedPacketCode,
  deleteAllRedPacketCodes,
  getBotStatus,
  setBotStatus,
  setActivityMeta,
  getActivityMeta,
} from "@/lib/db";

import { scrapeAccounts } from "@/lib/scraper";
import { revalidatePath } from "next/cache";
import { autoClaimPendingCodes as autoClaimPendingCodesLib } from "@/lib/claim-workflow";

// ─────────────────────────────────────────────────────────────────────────────
// GESTION DES COMPTES
// ─────────────────────────────────────────────────────────────────────────────

export async function getAccounts() {
  return getMonitoredAccounts();
}

export async function addAccount(formData) {
  const username = formData.get("username");
  if (!username) return { success: false, error: "Username is required" };

  const cleanUsername = username.trim().toLowerCase().replace("@", "");
  if (!cleanUsername) return { success: false, error: "Invalid username" };

  const result = addMonitoredAccount(cleanUsername);
  if (!result) return { success: false, error: "Ce compte existe déjà" };

  addScrapeLog("info", `Compte ajouté: @${cleanUsername}`);
  revalidatePath("/settings");
  return { success: true, account: result };
}

export async function removeAccount(id) {
  const result = removeMonitoredAccount(id);
  if (result) {
    addScrapeLog("info", `Compte supprimé id: ${id}`);
    revalidatePath("/settings");
  }
  return { success: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// GESTION DES CODES
// ─────────────────────────────────────────────────────────────────────────────

export async function getCodes() {
  return getRedPacketCodes();
}

export async function claimCode(id) {
  const { claimCodeLib } = await import("@/lib/claim-workflow");
  const result = await claimCodeLib(id);
  revalidatePath("/");
  return result;
}

export async function deleteCode(id) {
  const success = deleteRedPacketCode(id);
  if (success) revalidatePath("/");
  return { success };
}

export async function deleteAllCodes() {
  const count = deleteAllRedPacketCodes();
  if (count > 0) {
    addScrapeLog("info", `${count} code(s) supprimés`);
    revalidatePath("/");
  }
  return { success: true, count };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW AUTOMATIQUE COMPLET (non-bloquant)
// ─────────────────────────────────────────────────────────────────────────────

export async function runCronWorkflow() {
  const currentStatus = getBotStatus();
  if (currentStatus !== "idle") {
    addScrapeLog("info", `Workflow ignoré : bot déjà actif (${currentStatus})`);
    return { success: false, error: "Le bot est déjà actif" };
  }

  addScrapeLog("info", "=== Démarrage du Workflow Automatique ===");
  setBotStatus("scraping");

  // Exécution 100% asynchrone en arrière-plan — l'UI est immédiatement libérée
  (async () => {
    try {
      // Étape 1 : Scraping de tous les comptes surveillés
      const scrapeResult = await scrapeAccounts();
      
      // Sauvegarder les résultats pour l'UI temps réel
      setActivityMeta({
        currentAccount: null, // Scraping terminé
        lastScrapeAt: new Date().toISOString(),
        lastScrapeCodesFound: scrapeResult.codesFound,
        lastScrapeAccountsScraped: scrapeResult.accountsScraped,
        totalAccounts: getMonitoredAccounts().length,
      });

      addScrapeLog(
        "info",
        `Scraping terminé — ${scrapeResult.codesFound} nouveau(x) code(s) sur ${scrapeResult.accountsScraped} compte(s)`
      );

      // Étape 2 : Nettoyage des anciens codes
      const deletedCount = cleanupOldCodes();
      if (deletedCount > 0) {
        addScrapeLog("info", `Nettoyage: ${deletedCount} code(s) supprimés`);
      }

      // Étape 3 : Réclamation automatique de tous les codes en attente
      const pendingCodes = getRedPacketCodes().filter((c) => c.status === "unverified");
      if (pendingCodes.length > 0) {
        setBotStatus("claiming");
        addScrapeLog("info", `[Auto-Claim] ${pendingCodes.length} code(s) à réclamer automatiquement...`);
        await autoClaimPendingCodesLib();
      } else {
        addScrapeLog("info", "[Auto-Claim] Aucun code en attente.");
      }
    } catch (err) {
      addScrapeLog("error", `Erreur dans le Workflow: ${err.message}`);
    } finally {
      setBotStatus("idle");
      addScrapeLog("info", "=== Workflow Automatique Terminé ===");
    }
  })();

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARAMÈTRES
// ─────────────────────────────────────────────────────────────────────────────

export async function getSettings() {
  return {
    scrapingEnabled: getSetting("scraping_enabled") === "true",
    scrapeIntervalMinutes: parseInt(getSetting("scrape_interval_minutes") || "5", 10),
    maxCodeAgeMinutes: parseInt(getSetting("max_code_age_minutes") || "30", 10),
  };
}

export async function updateSettings(formData) {
  const scrapingEnabled = formData.get("scraping_enabled") === "true";
  const scrapeIntervalMinutes = formData.get("scrape_interval_minutes");
  const maxCodeAgeMinutes = formData.get("max_code_age_minutes");

  setSetting("scraping_enabled", scrapingEnabled.toString());
  if (scrapeIntervalMinutes) setSetting("scrape_interval_minutes", scrapeIntervalMinutes);
  if (maxCodeAgeMinutes) setSetting("max_code_age_minutes", maxCodeAgeMinutes);

  addScrapeLog("info", `Paramètres mis à jour — Scraping: ${scrapingEnabled}, Intervalle: ${scrapeIntervalMinutes}min, Âge max: ${maxCodeAgeMinutes}min`);
  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

export async function toggleScraping(enabled) {
  setSetting("scraping_enabled", enabled.toString());
  addScrapeLog("info", `Scraping automatique ${enabled ? "activé" : "désactivé"}`);
  revalidatePath("/");
  revalidatePath("/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────────────────────────────────────

export async function getLogs(limit = 100) {
  return getScrapeLogs(limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUT DU BOT (utilisé par /api/status)
// ─────────────────────────────────────────────────────────────────────────────

export async function getBotStatusAction() {
  return getBotStatus();
}

export async function purgeOldCodes() {
  const { clearOldCodes } = await import("@/lib/db");
  const count = clearOldCodes();
  revalidatePath("/");
  return { success: true, count };
}
