import {
  addRedPacketCode,
  addScrapeLog,
  codeExistsByCode,
  getMonitoredAccounts,
  getSetting,
  updateAccountLastScraped,
} from "./db";

// Red packet code regex pattern
const RED_PACKET_REGEX = /BP[0-9A-Za-z]{8,}/g;

// Random delay between requests (2-5 seconds)
function randomDelay() {
  const delay = 2000 + Math.random() * 3000;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// User agents for rotation
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Extract red packet codes from text
export function extractRedPacketCodes(text) {
  const matches = text.match(RED_PACKET_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
}

// Nitter instances (alternative Twitter frontend)
const NITTER_INSTANCES = [
  "nitter.poast.org",
  "nitter.privacydev.net",
  "nitter.1d4.us",
  "nitter.kavin.rocks",
];

async function fetchFromNitter(username) {
  const tweets = [];

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${username}`;
      addScrapeLog(
        "info",
        `Fetching from ${instance}`,
        `Username: ${username}`,
      );

      const response = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        addScrapeLog("warn", `Nitter ${instance} returned ${response.status}`);
        continue;
      }

      const html = await response.text();

      if (
        html.includes("rate limited") ||
        html.includes("blocked") ||
        html.includes("captcha")
      ) {
        addScrapeLog("warn", `Nitter ${instance} rate limited`);
        continue;
      }

      // Parse tweet content from Nitter HTML
      const tweetMatches = html.matchAll(
        /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      );

      let index = 0;
      for (const match of tweetMatches) {
        if (index >= 10) break;

        const tweetText = match[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim();

        if (tweetText) {
          tweets.push({
            id: `${username}-${Date.now()}-${index}`,
            text: tweetText,
            author: username,
          });
        }
        index++;
      }

      if (tweets.length > 0) {
        addScrapeLog("info", `Got ${tweets.length} tweets from ${instance}`);
        return tweets;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addScrapeLog("warn", `Nitter ${instance} failed: ${errorMessage}`);
    }

    await randomDelay();
  }

  return tweets;
}

// Twitter syndication endpoint fallback
async function fetchFromTwitterSyndication(username) {
  try {
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      addScrapeLog("warn", `Twitter syndication returned ${response.status}`);
      return [];
    }

    const html = await response.text();
    const tweets = [];

    const tweetMatches = html.matchAll(
      /data-tweet-id="(\d+)"[^>]*>[\s\S]*?<p[^>]*class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    );

    let index = 0;
    for (const match of tweetMatches) {
      if (index >= 10) break;

      const tweetId = match[1];
      const tweetText = match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

      if (tweetText) {
        tweets.push({
          id: tweetId,
          text: tweetText,
          author: username,
        });
      }
      index++;
    }

    if (tweets.length > 0) {
      addScrapeLog("info", `Got ${tweets.length} tweets from syndication`);
    }

    return tweets;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    addScrapeLog("warn", `Syndication fetch failed: ${errorMessage}`);
    return [];
  }
}

// Main scraping function
export async function scrapeAccounts() {
  const scrapingEnabled = getSetting("scraping_enabled");
  if (scrapingEnabled !== "true") {
    addScrapeLog("info", "Scraping is disabled");
    return {
      codesFound: 0,
      accountsScraped: 0,
      errors: ["Scraping is disabled"],
    };
  }

  const accounts = getMonitoredAccounts();
  console.log("[v0] Accounts found:", accounts.length, accounts);

  if (accounts.length === 0) {
    addScrapeLog(
      "warn",
      "No accounts to monitor - add accounts in Settings first",
    );
    return {
      codesFound: 0,
      accountsScraped: 0,
      errors: ["No accounts configured - add accounts in Settings"],
    };
  }

  addScrapeLog("info", `Starting scrape of ${accounts.length} accounts`);

  let codesFound = 0;
  let accountsScraped = 0;
  const errors = [];

  for (const account of accounts) {
    try {
      addScrapeLog("info", `Scraping @${account.username}`);

      // Try Nitter first, then syndication
      let tweets = await fetchFromNitter(account.username);

      if (tweets.length === 0) {
        addScrapeLog(
          "info",
          `Nitter failed for @${account.username}, trying syndication`,
        );
        tweets = await fetchFromTwitterSyndication(account.username);
      }

      if (tweets.length === 0) {
        addScrapeLog("warn", `No tweets found for @${account.username}`);
        errors.push(`No tweets for @${account.username}`);
        continue;
      }

      // Extract and save codes
      for (const tweet of tweets) {
        const codes = extractRedPacketCodes(tweet.text);

        for (const code of codes) {
          if (codeExistsByCode(code)) {
            addScrapeLog("info", `Code ${code} already exists`);
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
            addScrapeLog(
              "info",
              `Found new code: ${code} from @${tweet.author}`,
            );
          }
        }
      }

      updateAccountLastScraped(account.id);
      accountsScraped++;

      // Delay between accounts
      if (accounts.indexOf(account) < accounts.length - 1) {
        await randomDelay();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addScrapeLog(
        "error",
        `Error scraping @${account.username}: ${errorMessage}`,
      );
      errors.push(`Error: @${account.username}`);
    }
  }

  addScrapeLog(
    "info",
    `Scrape complete. Found ${codesFound} codes from ${accountsScraped} accounts`,
  );

  return { codesFound, accountsScraped, errors };
}
