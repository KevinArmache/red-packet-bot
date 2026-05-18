import { scrapeAccounts } from './src/lib/scraper.js';

async function test() {
  console.log("Starting scrapeAccounts test...");
  const result = await scrapeAccounts();
  console.log("Result:", result);
}
test();
