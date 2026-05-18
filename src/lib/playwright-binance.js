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

    // S'assurer d'avoir un contexte valide, avec retry si newPage échoue
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const context = await getPersistentContext();
        page = await context.newPage();
        break; // succès, on sort de la boucle
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

    await page.goto("https://www.binance.com/fr/my/wallet/account/payment/cryptobox", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

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

    await inputLocator.fill(code);

    const claimButton = page.locator("button").filter({ hasText: /Claim|Réclamer|Redeem|Obtenir/i }).first();
    await claimButton.click();

    const resultIndicator = page.locator('[class*="success"] , [class*="error"] , div:has-text("Fully Claimed")');
    await resultIndicator.first().waitFor({ state: "visible", timeout: 15000 });

    await page.waitForTimeout(1000);
    const pageText = await page.locator("body").innerText();
    const textUpper = pageText.toUpperCase();

    if (textUpper.includes("FULLY CLAIMED") || textUpper.includes("DÉJÀ RÉCLAMÉ")) {
      return { success: false, reason: "already_claimed", error: "Code déjà utilisé." };
    }
    if (textUpper.includes("EXPIRED") || textUpper.includes("EXPIRÉ")) {
      return { success: false, reason: "expired", error: "Code expiré." };
    }
    if (textUpper.includes("INVALID") || textUpper.includes("INVALIDE")) {
      return { success: false, reason: "invalid", error: "Code invalide." };
    }

    const openButton = page.locator("button").filter({ hasText: /Open|Ouvrir/i }).first();
    if (await openButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await openButton.click();
      await page.waitForTimeout(2000);
    }

    const resultContainer = page.locator('[class*="result"] , [class*="reward"]').first();
    const rewardText = await resultContainer.isVisible() ? await resultContainer.innerText() : pageText;
    const amountMatch = rewardText.match(/([0-9]+[.,]?[0-9]*)\s*([A-Z]{2,5})\b/);
    if (amountMatch) {
      const amount = amountMatch[1].replace(",", ".");
      const token = amountMatch[2];
      return { success: true, amount, token };
    }

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
  if (globalContext) {
    await globalContext.close();
    globalContext = null;
    console.log("[Playwright] Navigateur fermé.");
  }
}

export async function disconnectBrowser() {
  await closeBrowser();
}