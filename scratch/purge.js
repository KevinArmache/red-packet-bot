const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const initialCount = data.red_packet_codes.length;
// On garde uniquement les codes qui ne sont PAS vides, expirés, ou invalides.
// "unverified", "claiming", "claimed" sont gardés.
data.red_packet_codes = data.red_packet_codes.filter(c => 
  !['empty', 'expired', 'invalid', 'failed'].includes(c.status)
);

const finalCount = data.red_packet_codes.length;
fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

console.log(`Purge terminee. ${initialCount - finalCount} codes morts supprimes.`);
