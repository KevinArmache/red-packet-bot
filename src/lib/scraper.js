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

function cleanHtml(html = "") {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1 : NITTER (frontend Twitter open-source, 100% GRATUIT)
// Liste d'instances publiques — mise à jour régulièrement
// ─────────────────────────────────────────────────────────────────────────────
const NITTER_INSTANCES = [
  "nitter.poast.org",
  "nitter.privacydev.net",
  "nitter.lucabased.space",
  "nitter.mint.lgbt",
  "nitter.bus-hit.me",
  "nitter.42l.fr",
  "nitter.fdn.fr",
  "nitter.1d4.us",
  "nitter.kavin.rocks",
  "nitter.net",
];

async function fetchFromNitter(username) {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${username}`;
      addScrapeLog("info", `[Nitter] Essai ${instance} → @${username}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": randomUA(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        addScrapeLog("warn", `[Nitter] ${instance} → HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      if (
        html.length < 1000 ||
        html.includes("rate limited") ||
        html.includes("not available") ||
        html.includes("Access denied") ||
        html.includes("captcha") ||
        html.includes("Instance is not") ||
        !html.includes("timeline")
      ) {
        addScrapeLog("warn", `[Nitter] ${instance} bloqué ou vide`);
        continue;
      }

      const tweets = [];

      // Pattern A : div.tweet-content (Nitter récent)
      const patternA = [
        ...html.matchAll(
          /<div[^>]+class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        ),
      ];
      for (const m of patternA) {
        if (tweets.length >= 20) break;
        const t = cleanHtml(m[1]);
        if (t.length > 5)
          tweets.push({
            id: `nitter-${instance}-${tweets.length}`,
            text: t,
            author: username,
          });
      }

      // Pattern B : p.tweet-text (ancien Nitter)
      if (tweets.length === 0) {
        const patternB = [
          ...html.matchAll(
            /<p[^>]+class="[^"]*tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
          ),
        ];
        for (const m of patternB) {
          if (tweets.length >= 20) break;
          const t = cleanHtml(m[1]);
          if (t.length > 5)
            tweets.push({
              id: `nitter-${instance}-${tweets.length}`,
              text: t,
              author: username,
            });
        }
      }

      if (tweets.length > 0) {
        addScrapeLog(
          "info",
          `[Nitter] ${instance} → ${tweets.length} tweet(s) pour @${username}`,
        );
        return tweets;
      }

      addScrapeLog("warn", `[Nitter] ${instance} → 0 tweet parsé`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addScrapeLog("warn", `[Nitter] ${instance} erreur: ${msg}`);
    }

    await randomDelay(300, 800);
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2 : Twitter oEmbed (GRATUIT — endpoint public)
// Récupère le dernier tweet épinglé / profil embed
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromOembed(username) {
  try {
    const url = `https://publish.twitter.com/oembed?url=https://twitter.com/${username}&omit_script=true&limit=5`;
    const response = await fetch(url, {
      headers: { "User-Agent": randomUA(), Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const html = data?.html || "";
    if (!html) return [];

    const text = cleanHtml(html);
    if (!text || text.length < 5) return [];

    addScrapeLog("info", `[oEmbed] Tweet récupéré pour @${username}`);
    return [{ id: `oembed-${username}-${Date.now()}`, text, author: username }];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3 : Scraping Twitter Search (gratuit via l'interface web mobile)
// Recherche les tweets contenant des codes pour un compte donné
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromTwitterSearch(username) {
  try {
    // Utilise l'URL de recherche publique Twitter (sans login)
    const query = encodeURIComponent(
      `from:${username} red packet OR gift OR code BP`,
    );
    const url = `https://mobile.twitter.com/search?q=${query}&src=typed_query&f=live`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!response.ok) return [];

    const html = await response.text();
    const tweets = [];

    // Extraire les tweets depuis le HTML mobile Twitter
    const tweetPatterns = [
      /<div[^>]+data-testid="tweetText"[^>]*>([\s\S]*?)<\/div>/gi,
      /<p[^>]+lang="[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    ];

    for (const pattern of tweetPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const m of matches) {
        if (tweets.length >= 15) break;
        const t = cleanHtml(m[1]);
        if (t.length > 5)
          tweets.push({
            id: `tw-search-${tweets.length}`,
            text: t,
            author: username,
          });
      }
      if (tweets.length > 0) break;
    }

    if (tweets.length > 0) {
      addScrapeLog(
        "info",
        `[TW Search] ${tweets.length} tweet(s) pour @${username}`,
      );
    }
    return tweets;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 4 : Syndication Twitter (endpoint legacy, parfois accessible)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromSyndication(username) {
  try {
    const url = `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${username}&count=20&callback=__twttr`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": randomUA(),
        Referer: "https://platform.twitter.com",
        Accept: "*/*",
        Origin: "https://platform.twitter.com",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    let text = await response.text();
    // Enlève le wrapper JSONP
    text = text
      .replace(/^__twttr\(/, "")
      .replace(/\)$/, "")
      .trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }

    const tweets = [];
    const items =
      data?.timeline?.instructions?.[0]?.addEntries?.entries ||
      data?.globalObjects?.tweets ||
      [];

    if (Array.isArray(items)) {
      for (const entry of items) {
        if (tweets.length >= 15) break;
        const t =
          entry?.content?.item?.content?.tweet?.full_text ||
          entry?.tweet?.full_text ||
          "";
        if (t.length > 5) {
          tweets.push({
            id: `syndication-${tweets.length}`,
            text: t,
            author: username,
          });
        }
      }
    } else if (typeof items === "object") {
      for (const id of Object.keys(items)) {
        if (tweets.length >= 15) break;
        const t = items[id]?.full_text || "";
        if (t.length > 5) {
          tweets.push({ id: `syndication-${id}`, text: t, author: username });
        }
      }
    }

    if (tweets.length > 0) {
      addScrapeLog(
        "info",
        `[Syndication] ${tweets.length} tweet(s) pour @${username}`,
      );
    }
    return tweets;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPING D'UN COMPTE — cascade de sources gratuites
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeAccount(account) {
  const { username } = account;
  let tweets = [];

  // 1. Playwright
  tweets = await fetchFromPlaywright(username);
  if (tweets.length > 0) return tweets;

  // 1. Nitter (le plus fiable — open-source, gratuit)
  tweets = await fetchFromNitter(username);
  if (tweets.length > 0) return tweets;

  // 2. Syndication Twitter (endpoint legacy, parfois accessible)
  addScrapeLog("info", `[Fallback] Syndication pour @${username}`);
  tweets = await fetchFromSyndication(username);
  if (tweets.length > 0) return tweets;

  // 3. Recherche Twitter mobile (sans API)
  addScrapeLog("info", `[Fallback] Twitter Search pour @${username}`);
  tweets = await fetchFromTwitterSearch(username);
  if (tweets.length > 0) return tweets;

  // 4. oEmbed (au moins le tweet épinglé)
  addScrapeLog("info", `[Fallback] oEmbed pour @${username}`);
  tweets = await fetchFromOembed(username);

  return tweets;
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

    // récupération tweets
    const tweetTexts = await page
      .locator('[data-testid="tweetText"]')
      .allInnerTexts();

    addScrapeLog(
      "info",
      `[Playwright] ${tweetTexts.length} tweetText trouvé(s)`,
    );

    const tweets = [];

    for (let i = 0; i < tweetTexts.length; i++) {
      tweets.push({
        id: `pw-${i}`,
        text: tweetTexts[i],
        author: username,
      });
    }

    // fallback :
    // si aucun tweet détecté MAIS des codes dans le body
    if (tweets.length === 0 && foundCodes.length > 0) {
      tweets.push({
        id: "pw-body-fallback",
        text: bodyText,
        author: username,
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
