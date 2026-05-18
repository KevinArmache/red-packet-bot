import {
  addScrapeLog,
  getCodeById,
  getRedPacketCodes,
  recordClaimAttempt,
  updateCodeStatus,
  setBotStatus,
} from "./db";
import {
  claimBinanceRedPacketPlaywright,
  closeBrowser,
} from "./playwright-binance";

/**
 * Effectue un claim pour un code spécifique (utilisé pour le claim manuel depuis l'UI).
 */
export async function claimCodeLib(id) {
  const code = getCodeById(id);
  if (!code) return { success: false, error: "Code introuvable" };
  if (code.status === "claimed") return { success: false, error: "Déjà réclamé" };
  if (code.status === "claiming") return { success: false, error: "Réclamation déjà en cours" };

  addScrapeLog("info", `Claiming via Playwright: ${code.code}`);
  updateCodeStatus(code.id, "claiming");

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
    return { success: true, token: result.token, amount: result.amount };
  }

  recordClaimAttempt(id, false, result.error);

  if (result.reason === "empty" || result.reason === "already_claimed") {
    updateCodeStatus(id, "empty", "Déjà utilisé ou vide");
  } else if (result.reason === "expired") {
    updateCodeStatus(id, "expired");
  } else if (result.reason === "invalid") {
    updateCodeStatus(id, "invalid", result.error);
  } else {
    updateCodeStatus(id, "failed", result.error);
  }

  addScrapeLog("warn", `Claim failed: ${result.error}`);
  return { success: false, error: result.error || "Erreur inconnue avec Playwright" };
}

/**
 * Parcourt TOUS les codes "unverified" et les réclame automatiquement.
 * Conçu pour être appelé depuis le workflow automatique (runCronWorkflow).
 */
export async function autoClaimPendingCodes() {
  const codes = getRedPacketCodes().filter((c) => c.status === "unverified");

  if (codes.length === 0) {
    addScrapeLog("info", "[Auto-Claim] Aucun code en attente à réclamer.");
    return { claimed: 0, failed: 0 };
  }

  setBotStatus("claiming");
  addScrapeLog(
    "info",
    `[Auto-Claim] Démarrage — ${codes.length} code(s) en attente.`
  );

  let claimedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < codes.length; i++) {
    const codeObj = codes[i];

    // Pause humaine aléatoire entre les claims pour éviter la détection (sauf pour le premier)
    if (i > 0) {
      const delay = Math.floor(Math.random() * (15000 - 7000 + 1)) + 7000;
      addScrapeLog(
        "info",
        `[Auto-Claim] Pause anti-détection de ${Math.round(delay / 1000)}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      addScrapeLog("info", `[Auto-Claim] Code ${i + 1}/${codes.length} : ${codeObj.code}`);
      const result = await claimCodeLib(codeObj.id);

      if (result.success) {
        claimedCount++;
        addScrapeLog(
          "info",
          `[Auto-Claim] ✅ Succès : ${codeObj.code} → ${result.amount} ${result.token}`
        );
      } else {
        failedCount++;
        addScrapeLog(
          "warn",
          `[Auto-Claim] ❌ Échec : ${codeObj.code} — ${result.error}`
        );
      }
    } catch (err) {
      failedCount++;
      updateCodeStatus(codeObj.id, "failed", err.message);
      addScrapeLog(
        "error",
        `[Auto-Claim] Erreur inattendue pour ${codeObj.code}: ${err.message}`
      );
    }
  }

  // Fermer proprement le navigateur après la session
  try {
    await closeBrowser();
  } catch {
    // Ignorer les erreurs de fermeture
  }

  setBotStatus("idle");
  addScrapeLog(
    "info",
    `[Auto-Claim] Session terminée — ${claimedCount} réclamé(s), ${failedCount} échec(s).`
  );

  return { claimed: claimedCount, failed: failedCount };
}
