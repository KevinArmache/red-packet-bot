// Test d'extraction des codes sur le vrai tweet observé
const tweetText = `💥🎁💥🎁💥🎁💥🎁💥🎁💥

🎁 BPTF0KM4MW

🎁 BPFO9MZM4M

🎁 3CWYBRZX

🎁 GXG1W03L

🎁 IBNXIRV5

🎁 VY15BU3V

🎁 DG64O62T

🎁 SY8DS4U9

💥🎁💥🎁💥🎁💥🎁💥🎁💥`;

const FALSE_POSITIVE_WORDS = new Set([
  "HTTPS","HTTP","HTML","JSON","USDT","BUSD","USDC","FDUSD",
  "BTC","ETH","BNB","XRP","DOGE","SHIB","AVAX","MATIC","LINK",
  "DOT","ADA","SOL","LUNA","ATOM","ALGO","NEAR","SAND","MANA",
  "AAVE","NFT","API","URL","BOT","SPAM","SCAN","CODE","GIFT",
  "TODAY","FROM","BINANCE","TWITTER","COINBASE","CRYPTO","DEFI",
]);

const CODE_PATTERNS = [
  /\bBP[0-9A-Za-z]{7,20}\b/g,
  /\b(?!BP)[A-Z0-9]{7,12}\b/g,
];

function isValidCode(code) {
  if (!code || code.length < 7 || code.length > 20) return false;
  if (FALSE_POSITIVE_WORDS.has(code.toUpperCase())) return false;
  const hasDigit = /[0-9]/.test(code);
  const hasLetter = /[A-Za-z]/.test(code);
  if (!hasDigit || !hasLetter) return false;
  if (/(.)\\1{2}/.test(code)) return false;
  if (/^[0-9]+$/.test(code)) return false;
  return true;
}

function extractRedPacketCodes(text) {
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

console.log("=== Test extractRedPacketCodes ===");
const codes = extractRedPacketCodes(tweetText);
console.log(`Codes trouvés (${codes.length}):`, codes);

console.log("\n=== Test extractNonBPCodes (ANCIEN - montre ce qui était perdu) ===");
const nonBP = codes.filter(c => !c.startsWith("BP"));
console.log(`Codes NON-BP (${nonBP.length}):`, nonBP);
console.log(`Codes BP perdus (${codes.length - nonBP.length}):`, codes.filter(c => c.startsWith("BP")));
