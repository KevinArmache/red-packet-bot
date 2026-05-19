import {
  addRedPacketCode,
  addScrapeLog,
  codeExistsByCode,
  getMonitoredAccounts,
  getRedPacketCodes,
  getSetting,
  updateAccountLastScraped,
  setActivityMeta,
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
  // Codes sans préfixe BP : 7-12 chars, majuscules+chiffres (ex: 3ADKZW2C)
  /\b(?!BP)[A-Z0-9]{7,12}\b/g,
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

// Garde extractNonBPCodes pour compatibilité mais extractRedPacketCodes est privilégié dans le scraper
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

const BROWSER_PROFILES = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    platform: '"Windows"',
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="123", "Google Chrome";v="123", "Not:A-Brand";v="8"',
    platform: '"macOS"',
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    platform: '"Windows"',
  }
];

function randomBrowserProfile() {
  return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPING D'UN SEUL COMPTE VIA TWITTER SYNDICATION (OFFICIEL)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromSyndication(username) {
  try {
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`;
    addScrapeLog("info", `[Twitter API] Récupération de @${username}`);

    const profile = randomBrowserProfile();

    const response = await fetch(url, {
      headers: {
        "User-Agent": profile.ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
        "Sec-Ch-Ua": profile.secChUa,
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": profile.platform,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      },
      signal: AbortSignal.timeout(10000), // Timeout étendu à 10s pour plus de sûreté
    });

    if (!response.ok) {
      addScrapeLog("warn", `[Twitter API] HTTP ${response.status} pour @${username}`);
      return { tweets: [] };
    }

    const html = await response.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    
    if (!match) {
      addScrapeLog("warn", `[Twitter API] JSON introuvable pour @${username} (compte suspendu ou inexistant ?)`);
      return { tweets: [] };
    }

    const data = JSON.parse(match[1]);
    const entries = data?.props?.pageProps?.timeline?.entries || [];
    
    const tweets = [];
    for (const entry of entries) {
      const tweetData = entry?.content?.tweet;
      if (!tweetData) continue;
      
      const text = tweetData.text;
      const timestampStr = tweetData.created_at; // Format: "Tue Jul 15 03:22:35 +0000 2025"
      const timestamp = timestampStr ? Date.parse(timestampStr) : null;
      const id = tweetData.id_str || `syndication-${Date.now()}-${Math.random()}`;

      if (text && text.length >= 4) {
        tweets.push({
          id,
          text,
          author: username,
          timestamp
        });
      }
    }

    addScrapeLog("info", `[Twitter API] ✅ ${tweets.length} tweet(s) lus pour @${username}`);
    return { tweets };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addScrapeLog("warn", `[Twitter API] Erreur pour @${username}: ${msg}`);
    return { tweets: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIN TWITTER SYNDICATION
// ─────────────────────────────────────────────────────────────────────────────

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

    // Accepter TOUS les codes : BP-préfixés ET sans préfixe
    const codes = extractRedPacketCodes(tweet.text);

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
  
  // Diffuser en temps réel le compte en cours de scraping pour l'UI
  setActivityMeta({ currentAccount: username });
  addScrapeLog("info", `Scraping @${username}...`);

  const { tweets } = await fetchFromSyndication(username);

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
// EXÉCUTION SÉQUENTIELLE PAR LOTS — 1 compte à la fois pour rester sous le radar
// ─────────────────────────────────────────────────────────────────────────────
async function runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);

    // Pause longue entre les requêtes pour ne pas déclencher l'anti-bot de Twitter
    if (i + batchSize < items.length) {
      const pause = randomInt(8000, 15000); // 8 à 15 secondes de pause
      addScrapeLog("info", `[Scraper] Pause anti-ban de ${Math.round(pause / 1000)}s...`);
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

  // BATCH_SIZE = 1 → Séquentiel obligatoire, voir runInBatches()
  const BATCH_SIZE = 1;

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
