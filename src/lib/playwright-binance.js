import { chromium } from "playwright";
import { execSync } from "child_process";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const USER_DATA_DIR = "C:\\Users\\pc\\Documents\\chrome-bot-profile";
const EXECUTABLE_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Singleton du contexte persistant
let globalContext = null;
let contextIsHealthy = false;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killExistingChrome() {
  try {
    execSync("taskkill /F /IM chrome.exe", { stdio: "ignore" });
    console.log("[Playwright] Processus Chrome existants fermés.");
  } catch {
    // Aucun processus Chrome actif — c'est normal
  }
}

/**
 * Simule la frappe humaine caractère par caractère.
 */
async function typeLikeHuman(locator, text) {
  await locator.focus();
  await locator.fill(""); // vider d'abord
  for (const char of text) {
    await locator.press(char);
    await sleep(Math.floor(Math.random() * 141) + 80); // 80–220ms par caractère
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GESTION DU CONTEXTE PLAYWRIGHT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si le contexte global est réellement utilisable.
 * Un contexte peut être "non null" mais déjà mort — on le teste vraiment.
 */
async function checkContextHealth() {
  if (!globalContext || !contextIsHealthy) return false;
  try {
    // Tenter d'ouvrir et fermer une page test — c'est la seule vraie vérification
    const testPage = await globalContext.newPage();
    await testPage.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Détruit proprement le contexte global.
 */
async function destroyContext() {
  contextIsHealthy = false;
  if (globalContext) {
    try {
      await globalContext.close();
    } catch {
      // Ignorer les erreurs de fermeture (déjà mort)
    }
    globalContext = null;
  }
}

/**
 * Lance un nouveau contexte Chrome persistant (avec le profil sauvegardé).
 * Tue les Chrome existants d'abord pour libérer le verrou de profil.
 */
async function launchFreshContext() {
  console.log("[Playwright] Lancement d'un nouveau contexte Chrome...");

  // Tuer les Chrome existants ET attendre que Windows libère le verrou de profil
  killExistingChrome();
  await sleep(2500);

  try {
    globalContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      executablePath: EXECUTABLE_PATH,
      viewport: { width: 1280, height: 800 },
      timeout: 30000,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-popup-blocking",
      ],
      // Headers furtifs anti-détection
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
    });

    // Écouter les événements de fermeture inattendue pour mettre à jour l'état
    globalContext.on("close", () => {
      console.log("[Playwright] ⚠️ Contexte fermé de manière inattendue.");
      contextIsHealthy = false;
      globalContext = null;
    });

    // Test de validité immédiat
    const testPage = await globalContext.newPage();
    await testPage.close();
    contextIsHealthy = true;

    console.log("[Playwright] ✅ Chrome lancé et contexte validé.");
    return globalContext;
  } catch (err) {
    contextIsHealthy = false;
    globalContext = null;
    throw new Error(`[Playwright] Échec du lancement : ${err.message}`);
  }
}

/**
 * Obtient un contexte utilisable — réutilise le contexte existant s'il est sain,
 * sinon en crée un nouveau.
 */
async function getContext() {
  const healthy = await checkContextHealth();
  if (healthy) {
    console.log("[Playwright] ♻️  Contexte existant réutilisé.");
    return globalContext;
  }

  if (globalContext) {
    console.log("[Playwright] Contexte existant mort — réinitialisation...");
    await destroyContext();
  }

  return launchFreshContext();
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM D'UN CODE RED PACKET VIA PLAYWRIGHT
// ─────────────────────────────────────────────────────────────────────────────

export async function claimBinanceRedPacketPlaywright(code) {
  let page = null;

  try {
    console.log(`\n--- DÉBUT CLAIM POUR CODE: ${code} ---`);

    // Obtenir un contexte fiable (avec retry en cas d'échec)
    let context = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        context = await getContext();
        page = await context.newPage();
        break;
      } catch (err) {
        console.warn(`[Playwright] Tentative ${attempt}/3 d'ouverture de page échouée : ${err.message}`);
        await destroyContext();
        if (attempt === 3) {
          return {
            success: false,
            reason: "browser_error",
            error: "Impossible de lancer Chrome après 3 tentatives.",
          };
        }
        await sleep(3000);
      }
    }

    if (!page) {
      return { success: false, reason: "browser_error", error: "Page non créée." };
    }

    console.log(`[Playwright] ✅ Onglet ouvert pour le code ${code}`);

    // ── Navigation vers la page de réclamation ──
    await page.goto("https://www.binance.com/fr/my/wallet/account/payment/cryptobox", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    // ── Attente du champ de saisie du code ──
    const inputSelector = 'input[placeholder*="Code"], input[placeholder*="code"], input[type="text"]';
    const inputLocator = page.locator(inputSelector).first();

    try {
      await inputLocator.waitFor({ state: "visible", timeout: 8000 });
      console.log("[Playwright] ✅ Champ de code trouvé — session active.");
    } catch {
      console.log("[Playwright] 🔐 Connexion Binance requise. En attente de la session...");
      await inputLocator.waitFor({ state: "visible", timeout: 120000 });
      console.log("[Playwright] ✅ Connexion détectée !");
    }

    // ── Saisie humaine du code ──
    await typeLikeHuman(inputLocator, code);

    // Pause de réflexion (naturel)
    await sleep(Math.floor(Math.random() * 1001) + 500); // 500–1500ms

    // ── Clic sur le bouton Claim avec simulation de survol ──
    const claimButton = page
      .locator("button")
      .filter({ hasText: /Claim|Réclamer|Redeem|Obtenir|Confirmer/i })
      .first();

    await claimButton.hover().catch(() => {});
    await sleep(Math.floor(Math.random() * 501) + 300); // 300–800ms
    await claimButton.click();

    // ── Attente d'un résultat (succès ou erreur) ──
    const errorLocator = page.locator(".bn-formItem-errMsg").first();
    const successLocator = page.locator(
      '[class*="success"], [class*="reward"], div:has-text("Open"), div:has-text("Ouvrir")'
    ).first();

    try {
      await Promise.race([
        errorLocator.waitFor({ state: "visible", timeout: 15000 }),
        successLocator.waitFor({ state: "visible", timeout: 15000 }),
      ]);
    } catch {
      console.log("[Playwright] Aucun indicateur après 15s, analyse de la page...");
    }

    await sleep(500);

    // ── Vérification du message d'erreur ──
    const errorVisible = await errorLocator.isVisible().catch(() => false);
    if (errorVisible) {
      const errorText = await errorLocator.innerText().catch(() => "Erreur inconnue");
      console.log(`[Playwright] ❌ Erreur Binance : ${errorText}`);

      const lower = errorText.toLowerCase();
      if (lower.includes("already") || lower.includes("déjà")) {
        return { success: false, reason: "already_claimed", error: errorText };
      }
      if (lower.includes("expired") || lower.includes("expiré")) {
        return { success: false, reason: "expired", error: errorText };
      }
      if (lower.includes("empty") || lower.includes("vide") || lower.includes("fully")) {
        return { success: false, reason: "empty", error: errorText };
      }
      return { success: false, reason: "invalid", error: errorText };
    }

    // ── Analyse du texte de la page pour détecter l'état ──
    const pageText = await page.locator("body").innerText().catch(() => "");
    const pageUpper = pageText.toUpperCase();

    if (pageUpper.includes("FULLY CLAIMED") || pageUpper.includes("DÉJÀ RÉCLAMÉ")) {
      return { success: false, reason: "already_claimed", error: "Code déjà réclamé." };
    }
    if (pageUpper.includes("EXPIRED") || pageUpper.includes("EXPIRÉ")) {
      return { success: false, reason: "expired", error: "Code expiré." };
    }
    if (pageUpper.includes("INVALID") || pageUpper.includes("INVALIDE") || pageUpper.includes("INCORRECT")) {
      return { success: false, reason: "invalid", error: "Code invalide." };
    }

    // ── Gestion du bouton "Ouvrir" / "Open" (boîte mystère) ──
    const openButton = page
      .locator('button:has-text("Ouvrir"), button:has-text("Open")')
      .first();

    if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[Playwright] 🎁 Bouton 'Ouvrir' détecté — ouverture de la boîte...");

      for (let clickAttempt = 0; clickAttempt < 3; clickAttempt++) {
        const visible = await openButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (!visible) break;

        await openButton.hover().catch(() => {});
        await sleep(Math.floor(Math.random() * 501) + 200);
        await openButton.click({ force: true });
        console.log(`[Playwright] Clic Ouvrir n°${clickAttempt + 1}`);
        await sleep(1000);
      }

      // Attente du montant de la récompense
      try {
        await Promise.race([
          page.waitForSelector('[class*="reward"]', { state: "visible", timeout: 20000 }),
          page.waitForSelector('[class*="success"]', { state: "visible", timeout: 20000 }),
          page.waitForSelector('text=/\\d+[.,]?\\d*\\s*[A-Z]{2,5}/', { timeout: 20000 }),
          // Ou disparition du bouton Ouvrir
          page
            .waitForFunction(() => !document.querySelector('button:has-text("Ouvrir"), button:has-text("Open")'), {
              timeout: 30000,
            })
            .catch(() => {}),
        ]);
      } catch {
        console.log("[Playwright] Pas d'indicateur de récompense après ouverture.");
      }
    }

    // ── Extraction du montant final ──
    let rewardText = "";
    const rewardLocator = page.locator('[class*="reward"], [class*="amount"], [class*="success"]').first();

    if (await rewardLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
      rewardText = await rewardLocator.innerText().catch(() => "");
    }

    if (!rewardText) {
      rewardText = await page.locator("body").innerText().catch(() => "");
    }

    const amountMatch = rewardText.match(/([0-9]+[.,]?[0-9]*)\s*([A-Z]{2,6})\b/);
    if (amountMatch) {
      console.log(`[Playwright] 🎉 Récompense : ${amountMatch[1]} ${amountMatch[2]}`);
      return {
        success: true,
        amount: amountMatch[1].replace(",", "."),
        token: amountMatch[2],
      };
    }

    // Succès présumé (page chargée sans erreur)
    console.log("[Playwright] ✅ Succès présumé (montant non extrait).");
    return { success: true, amount: "?", token: "?" };
  } catch (error) {
    console.error(`[Playwright] ❌ Erreur pour code ${code}: ${error.message}`);

    // Si le contexte est mort, on l'invalide pour le prochain claim
    if (
      error.message.includes("closed") ||
      error.message.includes("disconnected") ||
      error.message.includes("Target page")
    ) {
      console.warn("[Playwright] Contexte détecté comme mort — invalidation pour le prochain appel.");
      await destroyContext();
    }

    return { success: false, reason: "error", error: error.message };
  } finally {
    if (page) {
      await sleep(2000); // Laisser la page se stabiliser avant fermeture
      await page.close().catch(() => {});
      console.log(`[Playwright] Onglet fermé pour le code ${code}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS DE CONTRÔLE
// ─────────────────────────────────────────────────────────────────────────────

export async function closeBrowser() {
  await destroyContext();
  console.log("[Playwright] Navigateur fermé.");
}

// Alias pour rétrocompatibilité
export { closeBrowser as disconnectBrowser };