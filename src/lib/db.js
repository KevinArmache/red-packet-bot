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

let isDeduplicated = false;

// Load database from file
function loadDb() {
  try {
    if (existsSync(dbPath)) {
      const data = readFileSync(dbPath, "utf-8");
      const db = JSON.parse(data);
      
      // Nettoyage unique des doublons de codes au premier chargement
      if (!isDeduplicated && db.red_packet_codes) {
        const seen = new Set();
        const initialCount = db.red_packet_codes.length;
        db.red_packet_codes = db.red_packet_codes.filter(c => {
          const key = c.code.toUpperCase();
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        isDeduplicated = true;
        if (db.red_packet_codes.length < initialCount) {
          saveDb(db);
        }
      }
      
      return db;
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

  // Check if already exists (case-insensitive)
  if (db.red_packet_codes.some((c) => c.code.toUpperCase() === code.toUpperCase())) {
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
  if (key === "max_code_age_minutes") {
    return db.settings[key] ?? "30";
  }
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

export function codeExistsByCode(code) {
  const db = loadDb();
  return db.red_packet_codes.some((c) => c.code.toUpperCase() === code.toUpperCase());
}

export function deleteRedPacketCode(id) {
  const db = loadDb();
  const index = db.red_packet_codes.findIndex((c) => c.id === id);
  if (index === -1) return false;
  db.red_packet_codes.splice(index, 1);
  saveDb(db);
  return true;
}

export function deleteAllRedPacketCodes() {
  const db = loadDb();
  const count = db.red_packet_codes.length;
  db.red_packet_codes = [];
  saveDb(db);
  return count;
}

export function cleanupOldCodes() {
  const db = loadDb();
  // We remove invalid, expired, or failed right away. For claimed, we can remove them if they are older than 2 hours to keep the UI clean but show recent wins.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const initialCount = db.red_packet_codes.length;
  
  db.red_packet_codes = db.red_packet_codes.filter(c => {
    if (c.status === "invalid" || c.status === "expired" || c.status === "failed" || c.status === "empty") {
      return false; // delete
    }
    if (c.status === "claimed" && c.detected_at < twoHoursAgo) {
      return false; // delete old claimed
    }
    return true; // keep others
  });

  const deletedCount = initialCount - db.red_packet_codes.length;
  if (deletedCount > 0) {
    saveDb(db);
  }
  return deletedCount;
}
