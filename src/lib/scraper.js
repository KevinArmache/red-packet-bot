import {
  addRedPacketCode,
  addScrapeLog,
  codeExistsByCode,
  getMonitoredAccounts,
  getSetting,
  updateAccountLastScraped,
} from "./db";
import { chromium } from "playwright";
// ─────────────────────────────────────────────────────────────────────────────
// REGEX MULTI-FORMAT pour les codes red packet / gift card Binance
// Captures :
//   1. BP[alphanum]{8-20}  → format historique Binance Red Packet
//   2. [A-Z0-9]{12,20}     → codes majuscules sans préfixe (certains gift cards)
//   3. [A-Za-z0-9]{16}     → codes 16 chars mixtes (format typique gift card)
//   4. [A-Z]{2,4}[0-9A-Za-z]{8,18} → codes avec préfixe lettres (ex: GC12345...)
// Tous filtrés pour éviter les faux positifs (pas de mots courants)
// ─────────────────────────────────────────────────────────────────────────────

// Mots courants à exclure pour éviter les faux positifs
const FALSE_POSITIVE_WORDS = new Set([
  "HTTPS",
  "HTTP",
  "HTML",
  "JSON",
  "USDT",
  "BUSD",
  "USDC",
  "BTC",
  "ETH",
  "BNB",
  "XRP",
  "DOGE",
  "SHIB",
  "AVAX",
  "MATIC",
  "LINK",
  "DOT",
  "ADA",
  "SOL",
  "LUNA",
  "ATOM",
  "ALGO",
  "NEAR",
  "SAND",
  "MANA",
  "AAVE",
  "NFT",
  "API",
  "URL",
  "BOT",
  "SPAM",
  "SCAN",
  "CODE",
  "GIFT",
  "TODAY",
  "FROM",
  "BINANCE",
  "TWITTER",
  "COINBASE",
  "CRYPTO",
  "DEFI",
  "BLOCKCHAIN",
]);

// Patterns pour codes red packet (basé sur les vrais codes observés)
// Les codes de @Muhammadtari55 sont : PFJY6HOV, RHD6AW9, HFODK4T1, etc.
// Format : alphanumériques MAJUSCULES+chiffres, 7 à 12 caractères
const CODE_PATTERNS = [
  // 1. Codes BP classiques Binance Red Packet (BP + 7-20 chars)
  /\bBP[0-9A-Za-z]{7,20}\b/g,
  // 2. Codes non-BP : majuscules+chiffres, 7-12 chars, doit contenir au moins 1 chiffre
  /\b(?!BP)[A-Z0-9]{7,12}\b/g,
];

// Détermine si un code est valide (non-faux-positif)
function isValidCode(code) {
  if (!code || code.length < 7 || code.length > 24) return false;
  if (FALSE_POSITIVE_WORDS.has(code)) return false;
  // Doit contenir au moins 1 chiffre ET au moins 1 lettre
  const hasDigit = /[0-9]/.test(code);
  const hasLetter = /[A-Za-z]/.test(code);
  if (!hasDigit || !hasLetter) return false;
  // Pas que des lettres du dictionnaire courant (3 lettres identiques consécutives = faux positif)
  if (/([A-Z])\1{2}/.test(code)) return false;
  return true;
}

export function extractRedPacketCodes(text) {
  if (!text || typeof text !== "string") return [];

  const found = new Set();

  for (const pattern of CODE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      const code = match[0].trim();
      if (isValidCode(code)) {
        found.add(code);
      }
    }
  }

  return [...found];
}

// Variante : extrait UNIQUEMENT les codes ne commençant PAS par BP
export function extractNonBPCodes(text) {
  return extractRedPacketCodes(text).filter((c) => !c.startsWith("BP"));
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function randomDelay(minMs = 1000, maxMs = 3000) {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPING D'UN COMPTE — Playwright uniquement
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeAccount(account) {
  const { username } = account;
  return fetchFromPlaywright(username);
}

// ─────────────────────────────────────────────────────────────────────────────
// FONCTION PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────
export async function scrapeAccounts() {
  const scrapingEnabled = getSetting("scraping_enabled");
  if (scrapingEnabled !== "true") {
    addScrapeLog("info", "Scraping désactivé dans les paramètres");
    return {
      codesFound: 0,
      accountsScraped: 0,
      errors: ["Scraping désactivé"],
    };
  }

  const accounts = getMonitoredAccounts();
  if (accounts.length === 0) {
    addScrapeLog(
      "warn",
      "Aucun compte surveillé — ajoutez des comptes dans Paramètres",
    );
    return {
      codesFound: 0,
      accountsScraped: 0,
      errors: ["Aucun compte configuré"],
    };
  }

  addScrapeLog(
    "info",
    `=== Scraping démarré — ${accounts.length} compte(s) ===`,
  );

  let codesFound = 0;
  let accountsScraped = 0;
  const errors = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    try {
      addScrapeLog("info", `Scraping @${account.username}...`);

      const tweets = await scrapeAccount(account);

      if (tweets.length === 0) {
        addScrapeLog("warn", `Aucun tweet récupéré pour @${account.username}`);
        errors.push(`Aucun tweet pour @${account.username}`);
        continue;
      }

      // Extraction et sauvegarde des codes
      let newCodesForAccount = 0;
      for (const tweet of tweets) {
        // --- FILTRAGE STRICT DE L'AGE DU TWEET ---
        const maxAgeMinutes = parseInt(getSetting("max_code_age_minutes") || "30", 10);
        if (maxAgeMinutes && maxAgeMinutes > 0) {
          if (!tweet.timestamp) {
            addScrapeLog(
              "info",
              `[Scraper] Code(s) de @${tweet.author} ignoré(s) car sa date de publication n'a pas pu être validée.`,
            );
            continue;
          }
          const ageMs = Date.now() - tweet.timestamp;
          const maxAgeMs = maxAgeMinutes * 60 * 1000;
          if (ageMs > maxAgeMs) {
            addScrapeLog(
              "info",
              `[Scraper] Code(s) de @${tweet.author} ignoré(s) car le tweet est trop ancien (${Math.round(ageMs / 60000)} min > ${maxAgeMinutes} min)`,
            );
            continue;
          }
        }

        const codes = extractRedPacketCodes(tweet.text);
        for (const code of codes) {
          if (codeExistsByCode(code)) {
            addScrapeLog("info", `Code déjà connu: ${code}`);
            continue;
          }
          const result = addRedPacketCode(
            code,
            tweet.text,
            tweet.id,
            tweet.author,
          );
          if (result) {
            codesFound++;
            newCodesForAccount++;
            addScrapeLog(
              "info",
              `✅ Nouveau code: ${code} (via @${tweet.author})`,
            );
          }
        }
      }

      addScrapeLog(
        "info",
        `@${account.username} — ${tweets.length} tweet(s) analysé(s), ${newCodesForAccount} nouveau(x) code(s)`,
      );

      updateAccountLastScraped(account.id);
      accountsScraped++;

      // Délai poli entre comptes
      if (i < accounts.length - 1) {
        await randomDelay(2000, 4000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addScrapeLog("error", `Erreur scraping @${account.username}: ${msg}`);
      errors.push(`Erreur: @${account.username}`);
    }
  }

  addScrapeLog(
    "info",
    `=== Scraping terminé — ${codesFound} code(s) / ${accountsScraped} compte(s) ===`,
  );

  return { codesFound, accountsScraped, errors };
}

async function fetchFromPlaywright(username) {
  let browser;
  console.log("fetchFromPlaywright", username);
  try {
    addScrapeLog("info", `[Playwright] Scraping @${username}`);

    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: randomUA(),
      viewport: {
        width: 1280,
        height: 720,
      },
    });

    const page = await context.newPage();

    // bloque ressources lourdes
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();

      if (type === "image" || type === "media" || type === "font") {
        return route.abort();
      }

      return route.continue();
    });

    await page.goto(`https://x.com/${username}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // attendre chargement
    await page.waitForTimeout(5000);

    // scroll plusieurs fois
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 5000);
      await page.waitForTimeout(2000);
    }

    // DEBUG HTML
    const html = await page.content();

    addScrapeLog("info", `[Playwright] HTML length: ${html.length}`);

    // récupération brute texte page
    const bodyText = await page.locator("body").innerText();

    addScrapeLog("info", `[Playwright] Body text length: ${bodyText.length}`);

    // extraction codes directement depuis toute la page
    const foundCodes = extractRedPacketCodes(bodyText);

    addScrapeLog(
      "info",
      `[Playwright] ${foundCodes.length} code(s) trouvé(s) directement`,
    );

    // récupération structurée des tweets (texte et date)
    const tweetArticles = await page.locator('[data-testid="tweet"]').all();
    const tweets = [];

    for (let i = 0; i < tweetArticles.length; i++) {
      const article = tweetArticles[i];
      try {
        const textLocator = article.locator('[data-testid="tweetText"]').first();
        const timeLocator = article.locator('time').first();
        
        const text = await textLocator.isVisible() ? await textLocator.innerText() : "";
        const datetime = await timeLocator.isVisible() ? await timeLocator.getAttribute('datetime') : null;
        
        if (text) {
          tweets.push({
            id: datetime ? `pw-${datetime}-${i}` : `pw-${i}`,
            text,
            author: username,
            timestamp: datetime ? new Date(datetime).getTime() : Date.now(),
          });
        }
      } catch (e) {
        console.error("Erreur parsing tweet article:", e.message);
      }
    }

    addScrapeLog(
      "info",
      `[Playwright] ${tweets.length} tweet(s) structuré(s) trouvé(s)`,
    );

    // fallback si parsing structuré d'articles échoue
    if (tweets.length === 0) {
      const tweetTexts = await page
        .locator('[data-testid="tweetText"]')
        .allInnerTexts();

      for (let i = 0; i < tweetTexts.length; i++) {
        tweets.push({
          id: `pw-${i}`,
          text: tweetTexts[i],
          author: username,
          timestamp: Date.now(), // Fallback: considéré comme récent
        });
      }
    }

    // fallback :
    // si aucun tweet détecté MAIS des codes dans le body
    if (tweets.length === 0 && foundCodes.length > 0) {
      tweets.push({
        id: "pw-body-fallback",
        text: bodyText,
        author: username,
        timestamp: Date.now(),
      });
    }

    addScrapeLog("info", `[Playwright] ${tweets.length} tweet(s) final`);

    return tweets;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    addScrapeLog("error", `[Playwright] Erreur @${username}: ${msg}`);

    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
