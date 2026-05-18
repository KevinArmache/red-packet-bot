import {
  addRedPacketCode,
  addScrapeLog,
  codeExistsByCode,
  getMonitoredAccounts,
  getRedPacketCodes,
  getSetting,
  updateAccountLastScraped,
} from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// FAUX POSITIFS — Mots à exclure systématiquement
// ─────────────────────────────────────────────────────────────────────────────
const FALSE_POSITIVE_WORDS = new Set([
  "HTTPS", "HTTP", "HTML", "JSON", "USDT", "BUSD", "USDC", "FDUSD",
  "BTC", "ETH", "BNB", "XRP", "DOGE", "SHIB", "AVAX", "MATIC", "LINK",
  "DOT", "ADA", "SOL", "LUNA", "ATOM", "ALGO", "NEAR", "SAND", "MANA",
  "AAVE", "NFT", "API", "URL", "BOT", "SPAM", "SCAN", "CODE", "GIFT",
  "TODAY", "FROM", "BINANCE", "TWITTER", "COINBASE", "CRYPTO", "DEFI",
  "BLOCKCHAIN", "CLAIM", "FREE", "AIRDROP", "TOKEN", "COIN", "WALLET",
  "SEND", "JOIN", "CLICK", "LINK", "COPY", "PASTE", "FOLLOW", "LIKE",
  "SHARE", "RETWEET", "COMMENT", "REPLY", "CHECK", "OPEN", "ENTER",
  "YOUR", "THIS", "THAT", "HAVE", "WITH", "FROM", "WILL", "ALSO",
  "DONT", "CANT", "WONT", "LETS", "MAKE", "TAKE", "GIVE", "COME",
  "NEED", "WANT", "KNOW", "LOOK", "GOOD", "JUST", "LIKE", "TIME",
  "YEAR", "WEEK", "NEXT", "LAST", "FIRST", "ONLY", "EVEN",
  "EACH", "MUCH", "MORE", "LESS", "THAN", "THEN", "WHEN", "WHAT",
]);

// ─────────────────────────────────────────────────────────────────────────────
// PATTERNS DE CODES
// Format réel observé : PFJY6HOV, RHD6AW9, HFODK4T1, JH96JHR4 (7-12 chars)
// ─────────────────────────────────────────────────────────────────────────────
const CODE_PATTERNS = [
  // BP + 7-20 chars (codes BP classiques)
  /\bBP[0-9A-Za-z]{7,20}\b/g,
  // Codes sans préfixe BP : 7-12 chars, majuscules+chiffres
  /\b(?!BP)[A-Z][A-Z0-9]{6,11}\b/g,
];

function isValidCode(code) {
  if (!code || code.length < 7 || code.length > 20) return false;
  if (FALSE_POSITIVE_WORDS.has(code.toUpperCase())) return false;
  const hasDigit = /[0-9]/.test(code);
  const hasLetter = /[A-Za-z]/.test(code);
  if (!hasDigit || !hasLetter) return false;
  // Exclure les répétitions (AAA, 111, etc.)
  if (/(.)\1{2}/.test(code)) return false;
  // Exclure les codes purement numériques ou trop courts en lettres
  if (/^[0-9]+$/.test(code)) return false;
  return true;
}

export function extractRedPacketCodes(text) {
  if (!text || typeof text !== "string") return [];
  const found = new Set();
  for (const pattern of CODE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      const code = match[0].trim();
      if (isValidCode(code)) found.add(code);
    }
  }
  return [...found];
}

export function extractNonBPCodes(text) {
  return extractRedPacketCodes(text).filter((c) => !c.startsWith("BP"));
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
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
// PARSE DE DATE NITTER — Robuste pour tous les formats
// ─────────────────────────────────────────────────────────────────────────────
function parseNitterDate(block) {
  // Format 1 : <span class="tweet-date"><a ... title="May 18, 2026 · 3:45 PM UTC">
  const m1 = block.match(/class="[^"]*tweet-date[^"]*"[^>]*>\s*<a[^>]*title="([^"]+)"/i);
  if (m1) {
    const raw = m1[1].replace(/·/g, "").replace(/\s+/g, " ").trim();
    // "May 18, 2026 3:45 PM UTC" → UTC timestamp
    const withTz = raw.endsWith("UTC") ? raw.replace("UTC", "+00:00") : raw;
    const ts = Date.parse(withTz);
    if (!isNaN(ts)) return ts;
  }

  // Format 2 : datetime="2026-05-18T15:45:00Z"
  const m2 = block.match(/datetime="([^"]+)"/i);
  if (m2) {
    const ts = Date.parse(m2[1]);
    if (!isNaN(ts)) return ts;
  }

  // Format 3 : <time ... title="..."> avec une date ISO ou lisible
  const m3 = block.match(/<time[^>]+title="([^"]+)"/i);
  if (m3) {
    const ts = Date.parse(m3[1]);
    if (!isNaN(ts)) return ts;
  }

  // Pas de date trouvée → null (sera traité selon la config)
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCES NITTER — Classées par fiabilité
// ─────────────────────────────────────────────────────────────────────────────
const NITTER_INSTANCES = [
  "nitter.net",
  "nitter.poast.org",
  "nitter.privacydev.net",
  "nitter.lucabased.space",
  "nitter.mint.lgbt",
  "nitter.bus-hit.me",
  "nitter.42l.fr",
  "nitter.fdn.fr",
  "nitter.1d4.us",
  "nitter.kavin.rocks",
];

// État partagé des instances — on mémorise les instances défaillantes pour éviter de les réessayer trop tôt
const instanceFailures = new Map(); // instance → { failCount, lastFailAt }
const FAILURE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes de cooldown après 2 échecs consécutifs

function isInstanceCooledDown(instance) {
  const record = instanceFailures.get(instance);
  if (!record) return true;
  if (record.failCount < 2) return true;
  const elapsed = Date.now() - record.lastFailAt;
  return elapsed >= FAILURE_COOLDOWN_MS;
}

function markInstanceFailed(instance) {
  const record = instanceFailures.get(instance) || { failCount: 0, lastFailAt: 0 };
  instanceFailures.set(instance, {
    failCount: record.failCount + 1,
    lastFailAt: Date.now(),
  });
}

function markInstanceSuccess(instance) {
  instanceFailures.delete(instance);
}

function getAvailableInstances() {
  // Mélanger les instances pour distribuer la charge
  const available = NITTER_INSTANCES.filter(isInstanceCooledDown);
  if (available.length === 0) {
    // Si toutes sont en cooldown, réinitialiser et réessayer
    instanceFailures.clear();
    return [...NITTER_INSTANCES];
  }
  // Shuffle aléatoire pour répartir la charge
  return available.sort(() => Math.random() - 0.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE DES TWEETS DEPUIS LE HTML NITTER
// ─────────────────────────────────────────────────────────────────────────────
function parseTweetsFromHtml(html, username, instance) {
  const tweets = [];

  // Séparer par bloc de tweet
  const tweetBlocks = html.split('class="tweet-body"');
  for (let j = 1; j < tweetBlocks.length; j++) {
    const block = tweetBlocks[j];

    // Extraire le contenu du tweet
    const contentMatch =
      block.match(/<div[^>]+class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<p[^>]+class="[^"]*tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

    if (!contentMatch) continue;
    const text = cleanHtml(contentMatch[1]);
    if (text.length < 4) continue;

    const timestamp = parseNitterDate(block);

    tweets.push({
      id: `nitter-${instance}-${j}-${timestamp ?? Date.now()}`,
      text,
      author: username,
      timestamp, // null si non trouvé
    });
  }

  return tweets;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPING D'UN SEUL COMPTE VIA NITTER
// Tente toutes les instances disponibles jusqu'à succès.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromNitter(username) {
  const instances = getAvailableInstances();

  for (const instance of instances) {
    try {
      const url = `https://${instance}/${username}`;
      addScrapeLog("info", `[Nitter] ${instance} → @${username}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": randomUA(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        addScrapeLog("warn", `[Nitter] ${instance} → HTTP ${response.status}`);
        if (response.status === 429 || response.status === 503) {
          markInstanceFailed(instance);
        }
        continue;
      }

      const html = await response.text();

      // Vérifications de validité du contenu
      const isBlocked =
        html.length < 1500 ||
        html.includes("rate limited") ||
        html.includes("not available") ||
        html.includes("Access denied") ||
        html.includes("captcha") ||
        html.includes("Instance is not") ||
        html.includes("error-panel") ||
        !html.includes("timeline");

      if (isBlocked) {
        addScrapeLog("warn", `[Nitter] ${instance} → bloqué/vide pour @${username}`);
        markInstanceFailed(instance);
        continue;
      }

      const tweets = parseTweetsFromHtml(html, username, instance);

      if (tweets.length > 0) {
        markInstanceSuccess(instance);
        addScrapeLog("info", `[Nitter] ${instance} → ✅ ${tweets.length} tweet(s) pour @${username}`);
        return { tweets, instance };
      }

      addScrapeLog("warn", `[Nitter] ${instance} → 0 tweet parsé pour @${username}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkError = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("timeout");
      addScrapeLog("warn", `[Nitter] ${instance} → erreur: ${isNetworkError ? "connexion échouée" : msg}`);
      if (isNetworkError) markInstanceFailed(instance);
    }

    // Petite pause entre les instances pour éviter d'être détecté
    await sleep(randomInt(200, 600));
  }

  addScrapeLog("warn", `[Scraper] ❌ Toutes les instances Nitter ont échoué pour @${username}`);
  return { tweets: [], instance: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAITEMENT DES TWEETS D'UN COMPTE
// Filtre par âge, extrait et déduplique les codes.
// Reçoit le Set global de codes déjà vus (thread-safe via JS mono-thread)
// ─────────────────────────────────────────────────────────────────────────────
function processTweets(tweets, username, maxAgeMs, globalSeenCodes) {
  const newCodes = [];

  for (const tweet of tweets) {
    // Filtrage par âge
    if (maxAgeMs !== Infinity) {
      if (!tweet.timestamp) {
        // Date inconnue : on accepte si "sans limite", sinon on ignore
        continue;
      }
      const ageMs = Date.now() - tweet.timestamp;
      if (ageMs > maxAgeMs) {
        continue;
      }
    }

    const codes = extractNonBPCodes(tweet.text);

    for (const code of codes) {
      const key = code.toUpperCase();

      // 1. Vérification dans le Set global en mémoire (évite les doublons cross-comptes)
      if (globalSeenCodes.has(key)) continue;

      // 2. Marquer IMMÉDIATEMENT comme "vu" pour éviter la race condition
      // (JS est mono-threadé, donc cette opération est atomique dans une async function)
      globalSeenCodes.add(key);

      // 3. Vérification en base de données
      if (codeExistsByCode(code)) continue;

      // 4. Ajouter en base
      const result = addRedPacketCode(code, tweet.text, tweet.id, tweet.author);
      if (result) {
        newCodes.push({ code, author: tweet.author });
      }
    }
  }

  return newCodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAITEMENT D'UN COMPTE COMPLET (scraping + extraction)
// ─────────────────────────────────────────────────────────────────────────────
async function processAccount(account, maxAgeMs, globalSeenCodes) {
  const { username } = account;
  addScrapeLog("info", `Scraping @${username}...`);

  const { tweets, instance } = await fetchFromNitter(username);

  if (tweets.length === 0) {
    addScrapeLog("warn", `Aucun tweet récupéré pour @${username}`);
    return { username, tweetsCount: 0, newCodes: [], success: false };
  }

  const newCodes = processTweets(tweets, username, maxAgeMs, globalSeenCodes);

  for (const { code } of newCodes) {
    addScrapeLog("info", `✅ Nouveau code: ${code} (via @${username})`);
  }

  addScrapeLog(
    "info",
    `@${username} — ${tweets.length} tweet(s) analysé(s), ${newCodes.length} nouveau(x) code(s)`
  );

  updateAccountLastScraped(account.id);
  return { username, tweetsCount: tweets.length, newCodes, success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXÉCUTION PAR LOTS (batching) — Évite de saturer Nitter avec 100 requêtes
// ─────────────────────────────────────────────────────────────────────────────
async function runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);

    // Pause entre les lots pour éviter le rate-limiting
    if (i + batchSize < items.length) {
      const pause = randomInt(1500, 3000);
      addScrapeLog("info", `[Scraper] Pause ${Math.round(pause / 1000)}s entre les lots...`);
      await sleep(pause);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — Scrape tous les comptes surveillés
// ─────────────────────────────────────────────────────────────────────────────
export async function scrapeAccounts() {
  const scrapingEnabled = getSetting("scraping_enabled");
  if (scrapingEnabled !== "true") {
    addScrapeLog("info", "Scraping désactivé dans les paramètres");
    return { codesFound: 0, accountsScraped: 0, errors: ["Scraping désactivé"] };
  }

  const accounts = getMonitoredAccounts();
  if (accounts.length === 0) {
    addScrapeLog("warn", "Aucun compte surveillé — ajoutez des comptes dans Paramètres");
    return { codesFound: 0, accountsScraped: 0, errors: ["Aucun compte configuré"] };
  }

  const maxAgeMinutes = parseInt(getSetting("max_code_age_minutes") || "30", 10);
  const maxAgeMs = maxAgeMinutes > 0 ? maxAgeMinutes * 60 * 1000 : Infinity;

  addScrapeLog(
    "info",
    `=== Scraping démarré — ${accounts.length} compte(s) | Âge max: ${maxAgeMinutes > 0 ? maxAgeMinutes + " min" : "Sans limite"} ===`
  );

  // Set global de déduplication partagé entre tous les comptes
  // Pré-rempli avec tous les codes déjà en base pour éviter les re-détections
  const existingCodes = getRedPacketCodes();
  const globalSeenCodes = new Set(existingCodes.map((c) => c.code.toUpperCase()));
  addScrapeLog("info", `[Scraper] ${existingCodes.length} code(s) déjà en base — déduplication active`);

  let codesFound = 0;
  let accountsScraped = 0;
  const errors = [];

  // Taille du lot adaptatif : 3 pour < 10 comptes, 5 pour < 50, 8 pour + de 50
  const BATCH_SIZE = accounts.length <= 5 ? 2 : accounts.length <= 20 ? 3 : 5;
  addScrapeLog("info", `[Scraper] Traitement par lots de ${BATCH_SIZE} compte(s) en simultané`);

  const settledResults = await runInBatches(
    accounts,
    BATCH_SIZE,
    (account) => processAccount(account, maxAgeMs, globalSeenCodes)
  );

  for (const settled of settledResults) {
    if (settled.status === "rejected") {
      const msg = settled.reason?.message || String(settled.reason);
      addScrapeLog("error", `Erreur inattendue dans le scraping: ${msg}`);
      errors.push(msg);
    } else {
      const { tweetsCount, newCodes, success, username } = settled.value;
      if (success) {
        accountsScraped++;
        codesFound += newCodes.length;
      } else {
        errors.push(`Aucun tweet pour @${username}`);
      }
    }
  }

  addScrapeLog(
    "info",
    `=== Scraping terminé — ${codesFound} nouveau(x) code(s) sur ${accountsScraped}/${accounts.length} compte(s) ===`
  );

  return { codesFound, accountsScraped, errors };
}
