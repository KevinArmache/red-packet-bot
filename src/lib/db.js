import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

// Database path - using local file storage
const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "database.json");

// Ensure data directory exists
try {
  mkdirSync(dataDir, { recursive: true });
} catch {
  // Directory already exists
}

// Default database state
const defaultDb = {
  monitored_accounts: [],
  red_packet_codes: [],
  claim_attempts: [],
  scrape_logs: [],
  settings: {
    scraping_enabled: "true",
    scrape_interval_minutes: "5",
    test_mode: "true",
  },
  _nextId: {
    accounts: 1,
    codes: 1,
    attempts: 1,
    logs: 1,
  },
};

// Load database from file
function loadDb() {
  try {
    if (existsSync(dbPath)) {
      const data = readFileSync(dbPath, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // If loading fails, return default
  }
  return { ...defaultDb };
}

// Save database to file
function saveDb(db) {
  try {
    writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save database:", error);
  }
}

// Database helper functions
export function getMonitoredAccounts() {
  const db = loadDb();
  return [...db.monitored_accounts].sort((a, b) =>
    a.username.localeCompare(b.username),
  );
}

export function addMonitoredAccount(username) {
  const db = loadDb();
  const cleanUsername = username.toLowerCase().replace("@", "");

  // Check if already exists
  if (db.monitored_accounts.some((a) => a.username === cleanUsername)) {
    return null;
  }

  const account = {
    id: db._nextId.accounts++,
    username: cleanUsername,
    created_at: new Date().toISOString(),
    last_scraped_at: null,
  };
  db.monitored_accounts.push(account);
  saveDb(db);
  return account;
}

export function removeMonitoredAccount(id) {
  const db = loadDb();
  const index = db.monitored_accounts.findIndex((a) => a.id === id);
  if (index === -1) return false;
  db.monitored_accounts.splice(index, 1);
  saveDb(db);
  return true;
}

export function getRedPacketCodes() {
  const db = loadDb();
  return [...db.red_packet_codes].sort(
    (a, b) =>
      new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
  );
}

export function addRedPacketCode(code, tweetText, tweetId, author) {
  const db = loadDb();

  // Check if already exists
  if (db.red_packet_codes.some((c) => c.code === code)) {
    return null;
  }

  const newCode = {
    id: db._nextId.codes++,
    code,
    tweet_text: tweetText,
    tweet_id: tweetId,
    author,
    detected_at: new Date().toISOString(),
    status: "unverified",
    claim_result: null,
    claimed_asset: null,
    claimed_amount: null,
  };
  db.red_packet_codes.push(newCode);
  saveDb(db);
  return newCode;
}

export function updateCodeStatus(
  id,
  status,
  claimResult,
  claimedAsset,
  claimedAmount,
) {
  const db = loadDb();
  const code = db.red_packet_codes.find((c) => c.id === id);
  if (!code) return false;

  code.status = status;
  code.claim_result = claimResult ?? null;
  code.claimed_asset = claimedAsset ?? null;
  code.claimed_amount = claimedAmount ?? null;
  saveDb(db);
  return true;
}

export function getCodeById(id) {
  const db = loadDb();
  return db.red_packet_codes.find((c) => c.id === id) ?? null;
}

export function recordClaimAttempt(codeId, success, errorMessage) {
  const db = loadDb();
  const attempt = {
    id: db._nextId.attempts++,
    code_id: codeId,
    attempted_at: new Date().toISOString(),
    success,
    error_message: errorMessage ?? null,
  };
  db.claim_attempts.push(attempt);
  saveDb(db);
}

export function getFailedClaimAttemptsLast24Hours() {
  const db = loadDb();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return db.claim_attempts.filter((a) => !a.success && a.attempted_at > cutoff)
    .length;
}

export function addScrapeLog(level, message, details) {
  const db = loadDb();
  const log = {
    id: db._nextId.logs++,
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details ?? null,
  };
  db.scrape_logs.push(log);

  // Keep only last 1000 logs
  if (db.scrape_logs.length > 1000) {
    db.scrape_logs = db.scrape_logs.slice(-1000);
  }

  saveDb(db);
}

export function getScrapeLogs(limit = 100) {
  const db = loadDb();
  return [...db.scrape_logs]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}

export function getSetting(key) {
  const db = loadDb();
  return db.settings[key] ?? null;
}

export function setSetting(key, value) {
  const db = loadDb();
  db.settings[key] = value;
  saveDb(db);
}

export function updateAccountLastScraped(id) {
  const db = loadDb();
  const account = db.monitored_accounts.find((a) => a.id === id);
  if (account) {
    account.last_scraped_at = new Date().toISOString();
    saveDb(db);
  }
}

export function codeExistsByTweetId(tweetId) {
  const db = loadDb();
  return db.red_packet_codes.some((c) => c.tweet_id === tweetId);
}

export function codeExistsByCode(code) {
  const db = loadDb();
  return db.red_packet_codes.some((c) => c.code === code);
}
