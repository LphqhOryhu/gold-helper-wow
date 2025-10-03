const fs = require('fs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });
const REGION = process.env.BNET_REGION || 'eu';
const LOCALE = process.env.BNET_LOCALE || 'fr_FR';
const CLIENT_ID = process.env.BNET_CLIENT_ID;
const CLIENT_SECRET = process.env.BNET_CLIENT_SECRET;

const startId = Number(process.argv[2]) || 1;
const endId = Number(process.argv[3]) || 250000;
const BATCH_SIZE = 10; // nombre de requêtes simultanées

async function getToken() {
    console.log('BNET_CLIENT_ID:', process.env.BNET_CLIENT_ID);
    console.log('BNET_CLIENT_SECRET:', process.env.BNET_CLIENT_SECRET);

    const authHeader = 'Basic ' + Buffer.from(
        process.env.BNET_CLIENT_ID + ':' + process.env.BNET_CLIENT_SECRET
    ).toString('base64');
    console.log('Authorization header:', authHeader);

    const url = 'https://oauth.battle.net/token';
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    console.log('Request URL:', url);
    console.log('Request body:', body.toString());

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    console.log('Response status:', resp.status);
    const errorText = await resp.text();
    console.log('Response body:', errorText);

    if (!resp.ok) {
        throw new Error('Token error');
    }
    const data = JSON.parse(errorText);
    return data.access_token;
}

async function getItemName(itemId, token) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/item/${itemId}?namespace=static-${REGION}&locale=${LOCALE}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.name || null;
}

(async () => {
  const token = await getToken();
  let cache = {};
  // Charger le cache existant si présent
  if (fs.existsSync('src/lib/items-cache.json')) {
    cache = JSON.parse(fs.readFileSync('src/lib/items-cache.json', 'utf-8'));
  }
  const ids = [];
  for (let i = startId; i <= endId; i++) {
    if (!cache[i]) ids.push(i);
  }
  let done = 0;
  for (let batchStart = 0; batchStart < ids.length; batchStart += BATCH_SIZE) {
    const batch = ids.slice(batchStart, batchStart + BATCH_SIZE);
    const results = await Promise.all(batch.map(async id => {
      const name = await getItemName(id, token);
      if (name) {
        cache[id] = name;
        process.stdout.write(`ID ${id}: ${name}\n`);
      } else {
        process.stdout.write(`ID ${id}: not found\n`);
      }
      return null;
    }));
    done += batch.length;
    fs.writeFileSync('src/lib/items-cache.json', JSON.stringify(cache, null, 2), 'utf-8');
    process.stdout.write(`Progress: ${done}/${ids.length} (ID ${batch[0]}-${batch[batch.length-1]})\r`);
  }
  console.log(`\nCache mis à jour dans src/lib/items-cache.json (${Object.keys(cache).length} items)`);
})();
