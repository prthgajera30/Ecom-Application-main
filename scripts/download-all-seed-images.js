#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SEED_TS = path.join(ROOT, 'apps', 'api', 'src', 'seeding.ts');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'seed-images');
const MAP_FILE = path.join(ROOT, 'apps', 'api', 'seed-image-map.json');

const PLACEHOLDER = 'https://placehold.co/1200x800?text=Image+Unavailable';

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function extractAllUrls() {
  const text = fs.readFileSync(SEED_TS, 'utf8');
  // match http/https urls inside quotes or bare
  const re = /(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)(?=["'\n\r,)]|$)/g;
  const matches = new Set();
  let m;
  while ((m = re.exec(text))) {
    matches.add(m[1]);
  }
  return Array.from(matches);
}

function urlExists(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          method: 'HEAD',
          host: u.hostname,
          path: u.pathname + u.search,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          timeout,
        },
        (res) => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
        },
      );
      req.on('error', () => resolve({ ok: false, status: null }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: null });
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, status: null });
    }
  });
}

function downloadToFile(url, destPath, timeout = 20000) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.get(url, { timeout }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`Status ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => fileStream.close(() => resolve(true)));
        fileStream.on('error', (err) => reject(err));
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  const force = process.argv.includes('--force');
  const dry = process.argv.includes('--dry');
  console.log(`download-all-seed-images: force=${force}, dry=${dry}`);

  ensureOutDir();

  const urls = extractAllUrls();
  console.log(`Found ${urls.length} unique URLs in ${SEED_TS}`);

  let map = {};
  if (!force && fs.existsSync(MAP_FILE)) {
    try { map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')); } catch (e) { map = {}; }
  }

  let downloaded = 0;
  const base = (process.env.NEXT_PUBLIC_SEED_IMAGE_BASE || 'http://localhost:3000').replace(/\/+$/, '');

  for (const url of urls) {
    if (map[url] && !force) {
      console.log(`SKIP mapped: ${url}`);
      continue;
    }

    const exists = await urlExists(url, 5000);
    if (!exists.ok) {
      console.log(`SKIP (not available): ${url} (status=${exists.status})`);
      map[url] = PLACEHOLDER;
      continue;
    }

    const u = new URL(url);
    let filenamePart = path.basename(u.pathname || '') || 'image';
    const extCandidate = filenamePart.includes('.') ? filenamePart.split('.').pop().split('?')[0] : '';
    const ext = extCandidate && !extCandidate.includes('/') ? extCandidate : 'jpg';
    const hash = Buffer.from(url).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 10);
    const safe = filenamePart.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
    const filename = `${safe}-${hash}.${ext}`;
    const dest = path.join(OUT_DIR, filename);

    if (dry) {
      console.log(`DRY: would download ${url} -> ${dest}`);
      map[url] = `${base}/seed-images/${filename}`;
      downloaded++;
      continue;
    }

    try {
      await downloadToFile(url, dest);
      map[url] = `${base}/seed-images/${filename}`;
      console.log(`Downloaded ${url} -> ${dest}`);
      downloaded++;
    } catch (e) {
      console.log(`Failed download ${url}: ${e.message}`);
      map[url] = PLACEHOLDER;
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
  console.log(`Wrote map ${MAP_FILE} with ${Object.keys(map).length} entries (downloaded ${downloaded})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
