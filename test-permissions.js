/**
 * Test des permissions de l'API key Binance
 * Vérifie si Gift Card est accessible et quelles permissions sont activées
 */
const fs = require('fs');
const crypto = require('crypto');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  let key = trimmed.substring(0, idx).trim();
  let val = trimmed.substring(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const API_KEY = env.BINANCE_API_KEY;
const PRIVATE_KEY_RAW = env.BINANCE_PRIVATE_KEY;

function normalizePem(raw) {
  let pem = raw.replace(/\\n/g, '\n');
  return pem;
}

function sign(payload, pem) {
  return crypto.sign('RSA-SHA256', Buffer.from(payload), {
    key: pem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }).toString('base64');
}

const pem = normalizePem(PRIVATE_KEY_RAW);

async function getWithAuth(path) {
  const ts = Date.now();
  const params = `timestamp=${ts}`;
  const sig = sign(params, pem);
  const url = `https://api.binance.com${path}?${params}&signature=${encodeURIComponent(sig)}`;
  const res = await fetch(url, { headers: { 'X-MBX-APIKEY': API_KEY } });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log('=== TEST PERMISSIONS API KEY ===\n');

  // 1. Infos API key (permissions activées)
  console.log('1. Permissions de la clé API:');
  const apiInfo = await getWithAuth('/sapi/v1/account/apiRestrictions');
  console.log('Status:', apiInfo.status);
  console.log(JSON.stringify(apiInfo.data, null, 2));

  await new Promise(r => setTimeout(r, 500));

  // 2. Test Gift Card verify (GET, moins restrictif)
  console.log('\n2. Test Gift Card verify (GET):');
  const ts2 = Date.now();
  const params2 = `referenceNo=TEST123&timestamp=${ts2}`;
  const sig2 = sign(params2, pem);
  const url2 = `https://api.binance.com/sapi/v1/giftcard/verify?${params2}&signature=${encodeURIComponent(sig2)}`;
  const res2 = await fetch(url2, { headers: { 'X-MBX-APIKEY': API_KEY } });
  const data2 = await res2.json();
  console.log('Status:', res2.status, '| Response:', JSON.stringify(data2));
}

main().catch(console.error);
