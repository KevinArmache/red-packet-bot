import {
  addRedPacketCode,
  addScrapeLog,
  codeExistsByCode,
  getMonitoredAccounts,
  getSetting,
  updateAccountLastScraped,
} from "./db";
// ─────────────────────────────────────────────────────────────────────────────
// REGEX MULTI-FORMAT pour les codes red packet / gift card Binance
// Captures :
//   1. BP[alphanum]{8-20}  → format historique Binance Red Packet (désormais ignoré via extractNonBPCodes)
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
// NETTOYAGE DU HTML
// ─────────────────────────────────────────────────────────────────────────────
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
// INSTANCES NITTER (100% anonyme, ultra-léger et gratuit)
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

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPING D'UN COMPTE VIA NITTER (Standard HTTP Fetch)
// ─────────────────────────────────────────────────────────────────────────────
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

      // Séparer l'HTML par bloc de tweet pour associer texte et date
      const tweetBlocks = html.split('class="tweet-body"');
      for (let j = 1; j < tweetBlocks.length; j++) {
        if (tweets.length >= 20) break;
        const block = tweetBlocks[j];
        
        const contentMatch = block.match(/<div[^>]+class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                             block.match(/<p[^>]+class="[^"]*tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (!contentMatch) continue;
        const text = cleanHtml(contentMatch[1]);
        if (text.length < 5) continue;
        
        const dateMatch = block.match(/<span[^>]+class="[^"]*tweet-date[^"]*"[^>]*><a[^>]+title="([^"]+)"/i);
        let timestamp = Date.now();
        if (dateMatch) {
          const dateStr = dateMatch[1].replace("·", "").trim();
          try {
            timestamp = new Date(dateStr).getTime();
          } catch (e) {
            // Ignorer l'erreur et garder Date.now()
          }
        }
        
        tweets.push({
          id: `nitter-${instance}-${j}-${timestamp}`,
          text,
          author: username,
          timestamp,
        });
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
// SCRAPING D'UN COMPTE — Nitter HTTP uniquement
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeAccount(account) {
  const { username } = account;
  return fetchFromNitter(username);
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

  // ✅ Nouveau : Set pour éviter les doublons dans la même session
  const seenCodes = new Set();

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

        // ✅ MODIFICATION : utiliser extractNonBPCodes pour ignorer les codes BP
        const codes = extractNonBPCodes(tweet.text);
        for (const code of codes) {
          // ✅ Vérification en mémoire d'abord (pas de doublon dans la session)
          if (seenCodes.has(code)) {
            addScrapeLog("info", `Code déjà vu dans cette session: ${code}`);
            continue;
          }

          if (codeExistsByCode(code)) {
            addScrapeLog("info", `Code déjà connu en base: ${code}`);
            seenCodes.add(code); // on le marque pour ne pas le re-vérifier
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
            seenCodes.add(code);
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
