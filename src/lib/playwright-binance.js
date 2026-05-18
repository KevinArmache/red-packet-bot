import { chromium } from "playwright";

let globalContext = null;

const USER_DATA_DIR = "C:\\Users\\pc\\Documents\\chrome-bot-profile";
const EXECUTABLE_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function getPersistentContext() {
  // Vérifier si le contexte est encore valide
  if (globalContext) {
    try {
      const pages = globalContext.pages();
      if (pages.length > 0) {
        await pages[0].evaluate(() => true);
      }
      console.log("[Playwright] Contexte existant toujours valide.");
      return globalContext;
    } catch {
      console.log("[Playwright] Contexte existant invalide, fermeture...");
      await globalContext.close().catch(() => { });
      globalContext = null;
    }
  }

  console.log("[Playwright] Lancement d’un nouveau Chrome...");
  try {
    globalContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
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

    // Remplir le code
    await inputLocator.fill(code);

    // Clic sur le bouton "Claim"
    const claimButton = page.locator("button").filter({ hasText: /Claim|Réclamer|Redeem|Obtenir/i }).first();
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

        // Clic avec retry en cas d'absence de réaction
        for (let clickAttempt = 0; clickAttempt < 2; clickAttempt++) {
          if (await openButton.isVisible({ timeout: 2000 }).catch(() => false)) {
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
      await page.close().catch(() => { });
      console.log(`[Playwright] Onglet fermé pour le code ${code}`);
    }
  }
}

export async function closeBrowser() {
  await page.waitForTimeout(20000);
  if (globalContext) {
    await globalContext.close();
    globalContext = null;
    console.log("[Playwright] Navigateur fermé.");
  }
}

export async function disconnectBrowser() {
  await page.waitForTimeout(20000);
  await closeBrowser();
}