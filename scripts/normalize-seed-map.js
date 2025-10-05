const fs = require('fs');
const path = require('path');

const MAP_FILE = path.resolve(__dirname, '..', 'apps', 'api', 'seed-image-map.json');

function cleanKey(k) {
  if (!k || typeof k !== 'string') return k;
  // remove surrounding quotes and trailing commas and whitespace
  return k.replace(/^["'\s]+/, '').replace(/["',\s]+$/g, '');
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.log(`No map at ${MAP_FILE}`);
    process.exit(0);
  }
  const raw = fs.readFileSync(MAP_FILE, 'utf8');
  let map;
  try { map = JSON.parse(raw); } catch (e) { console.error('Invalid JSON'); process.exit(2); }

  const newMap = {};
  for (const [k, v] of Object.entries(map)) {
    const kk = cleanKey(k);
    newMap[kk] = v;
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(newMap, null, 2), 'utf8');
  console.log(`Normalized ${Object.keys(map).length} keys -> ${Object.keys(newMap).length} keys written to ${MAP_FILE}`);
}

main();
