import { chromium } from "playwright";
import { execSync } from "child_process";

let globalBrowser = null;
let globalContext = null;

const USER_DATA_DIR = "C:\\Users\\pc\\Documents\\chrome-bot-profile";
const EXECUTABLE_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function killExistingChrome() {
  try {
    console.log("[Playwright] Tentative de fermeture des processus Chrome existants pour libérer le profil...");
    execSync("taskkill /F /IM chrome.exe", { stdio: "ignore" });
    console.log("[Playwright] Tous les processus Chrome ont été fermés.");
  } catch (e) {
    // Échoue silencieusement si aucun processus n'existe, ce qui est attendu
  }
}

async function typeLikeHuman(locator, text) {
  await locator.focus();
  await locator.fill("");
  for (const char of text) {
    await locator.press(char);
    // Délai aléatoire réaliste entre 80ms et 220ms par caractère
    const delay = Math.floor(Math.random() * (220 - 80 + 1)) + 80;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function getPersistentContext() {
  // 1. Vérifier si le contexte existant est encore valide
  if (globalContext) {
    try {
      const pages = globalContext.pages();
      if (pages.length > 0) {
        await pages[0].evaluate(() => true);
      }
      console.log("[Playwright] Contexte existant toujours valide.");
      return globalContext;
    } catch {
      console.log("[Playwright] Contexte existant invalide, réinitialisation...");
      await globalContext.close().catch(() => { });
      globalContext = null;
      if (globalBrowser) {
        await globalBrowser.close().catch(() => { });
        globalBrowser = null;
      }
    }
  }

  // 2. TENTATIVE A : Connexion à une instance Chrome existante via CDP (port 9222)
  console.log("[Playwright] Tentative de connexion CDP sur http://localhost:9222...");
  try {
    globalBrowser = await chromium.connectOverCDP("http://localhost:9222", {
      timeout: 5000,
    });
    const contexts = globalBrowser.contexts();
    if (contexts.length > 0) {
      globalContext = contexts[0];
      console.log("[Playwright] ✅ Connecté avec succès au Chrome existant via CDP !");
      return globalContext;
    } else {
      console.log("[Playwright] Connecté via CDP mais aucun contexte trouvé.");
      await globalBrowser.close().catch(() => { });
      globalBrowser = null;
    }
  } catch (err) {
    console.log(`[Playwright] Connexion CDP impossible (${err.message}).`);
  }

  // 3. TENTATIVE B : Lancement d'un nouveau Chrome persistant
  // Fermeture des processus Chrome existants pour libérer les verrous de fichiers sur le profil
  killExistingChrome();
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Laisser le temps à Windows de libérer le verrou

  console.log("[Playwright] Lancement d’un nouveau Chrome...");
  try {
    globalContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      // headless signifie sans interface graphique : oui ou non
      headless: true,
      executablePath: EXECUTABLE_PATH,
      viewport: null,
      timeout: 30000,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
    console.log("[Playwright] Chrome lancé avec succès.");

    // Test immédiat de validité
    const testPage = await globalContext.newPage();
    await testPage.close();
    console.log("[Playwright] Test de page OK, contexte prêt.");
    return globalContext;
  } catch (err) {
    console.error("[Playwright] Échec du lancement :", err.message);
    globalContext = null;
    throw err;
  }
}

export async function claimBinanceRedPacketPlaywright(code) {
  let page = null;
  try {
    console.log(`\n--- DÉBUT CLAIM POUR CODE: ${code} ---`);

    // Ouverture de page avec retry
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const context = await getPersistentContext();
        page = await context.newPage();
        break;
      } catch (err) {
        console.warn(`[Playwright] newPage échoué (tentative ${attempt}) : ${err.message}`);
        if (globalContext) {
          await globalContext.close().catch(() => { });
          globalContext = null;
        }
        if (attempt === maxRetries) {
          throw new Error("Impossible d’ouvrir une page après plusieurs tentatives.");
        }
      }
    }

    console.log(`[Playwright] Nouvel onglet ouvert pour le code ${code}`);

    // Navigation
    await page.goto("https://www.binance.com/fr/my/wallet/account/payment/cryptobox", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    // Attente du champ de code (connexion automatique ou manuelle)
    const inputSelector = 'input[placeholder*="Code"] , input[placeholder*="code"]';
    const inputLocator = page.locator(inputSelector).first();

    try {
      await inputLocator.waitFor({ state: "visible", timeout: 5000 });
      console.log("[Playwright] Champ de code trouvé – déjà connecté.");
    } catch {
      console.log("[Playwright] 🔐 Connexion requise. Connecte-toi dans l'onglet...");
      await inputLocator.waitFor({ state: "visible", timeout: 120000 });
      console.log("[Playwright] Connexion détectée !");
    }

    // Remplir le code de manière humaine (simule la frappe clavier)
    await typeLikeHuman(inputLocator, code);

    // Pause de réflexion humaine avant de cliquer (500ms à 1500ms)
    const thinkingDelay = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
    await page.waitForTimeout(thinkingDelay);

    // Clic sur le bouton "Claim" avec simulation de survol (hover)
    const claimButton = page.locator("button").filter({ hasText: /Claim|Réclamer|Redeem|Obtenir/i }).first();
    await claimButton.hover().catch(() => {});
    await page.waitForTimeout(Math.floor(Math.random() * (800 - 300 + 1)) + 300);
    await claimButton.click();

    // Attente des indicateurs d'erreur ou de succès après Claim
    const errorMsgLocator = page.locator('.bn-formItem-errMsg');
    const otherResultLocator = page.locator(`
      [class*="success"],
      div:has-text("Fully Claimed"),
      div:has-text("Already Claimed"),
      div:has-text("Expired"),
      div:has-text("Open")
    `);

    try {
      await Promise.race([
        errorMsgLocator.first().waitFor({ state: 'visible', timeout: 15000 }),
        otherResultLocator.first().waitFor({ state: 'visible', timeout: 15000 }),
      ]);
    } catch {
      console.log("[Playwright] Aucun indicateur visible après 15s, on analyse la page...");
    }

    await page.waitForTimeout(500);

    // Traitement des erreurs spécifiques
    const errorVisible = await errorMsgLocator.first().isVisible().catch(() => false);
    if (errorVisible) {
      const errorText = await errorMsgLocator.first().innerText();
      console.log(`[Playwright] Message d'erreur : ${errorText}`);
      return { success: false, reason: "invalid", error: errorText };
    }

    const pageText = await page.locator("body").innerText();
    const textUpper = pageText.toUpperCase();

    if (textUpper.includes("FULLY CLAIMED") || textUpper.includes("DÉJÀ RÉCLAMÉ")) {
      return { success: false, reason: "already_claimed", error: "Code déjà utilisé." };
    }
    if (textUpper.includes("EXPIRED") || textUpper.includes("EXPIRÉ")) {
      return { success: false, reason: "expired", error: "Code expiré." };
    }
    if (textUpper.includes("INVALID") || textUpper.includes("INVALIDE") || textUpper.includes("INCORRECT")) {
      return { success: false, reason: "invalid", error: "Code invalide." };
    }

    // ========== GESTION DU BOUTON "OUVRIR" ==========
    const openButton = page.locator('button.bn-button__primary:has-text("Ouvrir")')
      .or(page.locator('button.bn-button__primary:has-text("Open")'))
      .first();

    // Cas 1 : Récompense déjà visible (boîte déjà ouverte)
    const preRewardLocator = page.locator('[class*="reward"], [class*="amount"], [class*="success"]').first();
    if (await preRewardLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = await preRewardLocator.innerText().catch(() => '');
      const m = txt.match(/([0-9]+[.,]?[0-9]*)\s*([A-Z]{2,5})/);
      if (m) return { success: true, amount: m[1].replace(",", "."), token: m[2] };
    }

    // Cas 2 : Bouton Ouvrir présent
    if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[Playwright] Bouton 'Ouvrir' détecté, tentative d'ouverture...");

      try {
        // S'assurer qu'il est actif (non désactivé)
        await openButton.waitFor({ state: 'visible', timeout: 5000 });
        const isEnabled = await openButton.isEnabled().catch(() => false);
        if (!isEnabled) {
          // Attendre qu'il devienne actif (parfois délai avant activation)
          await page.waitForFunction(
            (btn) => !btn.disabled,
            await openButton.elementHandle(),
            { timeout: 5000 }
          ).catch(() => console.log("[Playwright] Le bouton Ouvrir reste désactivé, on clique quand même."));
        }

        // Clic avec retry en cas d'absence de réaction, avec simulation de survol (hover) humain
        for (let clickAttempt = 0; clickAttempt < 2; clickAttempt++) {
          if (await openButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await openButton.hover().catch(() => {});
            await page.waitForTimeout(Math.floor(Math.random() * (700 - 200 + 1)) + 200);
            await openButton.click({ force: true });
            console.log(`[Playwright] Clic sur Ouvrir tentative ${clickAttempt + 1}`);
            await page.waitForTimeout(800); // laisser l'animation se déclencher
          } else {
            break;
          }
        }

        // Attendre un indicateur de succès (montant, classe reward, ou disparition du bouton)
        try {
          await Promise.race([
            page.waitForSelector('[class*="reward"]', { state: 'visible', timeout: 15000 }),
            page.waitForSelector('[class*="success"]', { state: 'visible', timeout: 15000 }),
            page.waitForSelector('text=/\\d+[.,]?\\d*\\s*[A-Z]{2,5}/', { timeout: 15000 }),
            page.waitForFunction(
              () => !document.querySelector('button.bn-button__primary:has-text("Ouvrir")'),
              { timeout: 35000 }
            ),
          ]);
          console.log("[Playwright] Indicateur de succès détecté après ouverture.");
        } catch {
          console.log("[Playwright] Aucun indicateur après ouverture, vérification de la page...");
        }
      } catch (e) {
        console.log("[Playwright] Bouton Ouvrir introuvable ou non cliquable :", e.message);
      }
    } else {
      console.log("[Playwright] Aucun bouton 'Ouvrir' visible.");
    }

    // ========== EXTRACTION DU MONTANT FINAL ==========
    let rewardText = '';
    const finalRewardLocator = page.locator('[class*="reward"], [class*="amount"], [class*="success"]').first();
    if (await finalRewardLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
      rewardText = await finalRewardLocator.innerText().catch(() => '');
    } else {
      rewardText = await page.locator("body").innerText().catch(() => '');
    }

    const amountMatch = rewardText.match(/([0-9]+[.,]?[0-9]*)\s*([A-Z]{2,5})\b/);
    if (amountMatch) {
      return { success: true, amount: amountMatch[1].replace(",", "."), token: amountMatch[2] };
    }

    // Fallback
    console.log("[Playwright] Montant non détecté, succès présumé.");
    return { success: true, amount: "?", token: "?" };

  } catch (error) {
    console.error(`[Playwright] Erreur pour code ${code}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (page) {
      await page.waitForTimeout(3000);
      await page.close().catch(() => { });
      console.log(`[Playwright] Onglet fermé pour le code ${code}`);
    }
  }
}

export async function closeBrowser() {
  if (globalContext) {
    await globalContext.close().catch(() => { });
    globalContext = null;
  }
  if (globalBrowser) {
    await globalBrowser.close().catch(() => { });
    globalBrowser = null;
  }
  console.log("[Playwright] Navigateur fermé.");
}

export async function disconnectBrowser() {
  await closeBrowser();
}