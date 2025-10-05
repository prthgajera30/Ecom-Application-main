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

function downloadToFile(url, destPath, timeout = 15000) {
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

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function extractProducts() {
  const text = fs.readFileSync(SEED_TS, 'utf8');
  const lines = text.split(/\r?\n/);
  const products = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const slugMatch = line.match(/\bslug:\s*['"]([\w-]+)['"]/);
    if (slugMatch) {
      const slug = slugMatch[1];
      // scan forward for images: [ ... ] block
      let j = i;
      let images = [];
      while (j < Math.min(lines.length, i + 120)) {
        const l = lines[j];
        const imagesStart = l.match(/\bimages:\s*\[/);
        if (imagesStart) {
          let k = j + 1;
          const acc = [];
          while (k < lines.length) {
            const lineK = lines[k].trim();
            const urlMatch = lineK.match(/['"](https?:\/\/[^'\"]+)['"]/);
            if (urlMatch) acc.push(urlMatch[1]);
            if (lineK.includes(']')) break;
            k++;
          }
          images = acc;
          break;
        }
        j++;
      }
      products.push({ slug, images });
      i = j;
    }
    i++;
  }
  return products;
}

async function main() {
  const dry = process.argv.includes('--dry');
  console.log(`download-seed-images: dry=${dry}`);
  ensureOutDir();

  const products = extractProducts();
  const uniqueUrls = new Map();
  for (const p of products) {
    for (const url of p.images) {
      if (!uniqueUrls.has(url)) uniqueUrls.set(url, []);
      uniqueUrls.get(url).push(p.slug);
    }
  }

  console.log(`Found ${products.length} products and ${uniqueUrls.size} unique image URLs`);

  const force = process.argv.includes('--force');
  const map = (!force && fs.existsSync(MAP_FILE)) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};

  let downloaded = 0;
  const base = (process.env.NEXT_PUBLIC_SEED_IMAGE_BASE || 'http://localhost:3000').replace(/\/+$/, '');
  for (const [url, slugs] of uniqueUrls.entries()) {
    if (map[url]) continue; // already mapped
    const res = await urlExists(url, 5000);
    if (!res.ok) {
      console.log(`SKIP (broken): ${url} (status=${res.status})`);
      map[url] = PLACEHOLDER;
      continue;
    }

    // choose filename based on first slug + a small hash
    const u = new URL(url);
    const filenamePart = path.basename(u.pathname || '') || 'image';
    const extCandidate = filenamePart.includes('.') ? filenamePart.split('.').pop().split('?')[0] : '';
    const ext = extCandidate && !extCandidate.includes('/') ? extCandidate : 'jpg';
        // base64url-safe short hash
        const hash = Buffer.from(url)
          .toString('base64')
          .replace(/=+$/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .slice(0, 8);
      const safeSlug = slugs[0].replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const filename = `${safeSlug}-${downloaded}-${hash}.${ext}`;
  const dest = path.join(OUT_DIR, filename);
    if (dry) {
      console.log(`DRY: would download ${url} -> ${dest}`);
        const base = (process.env.NEXT_PUBLIC_SEED_IMAGE_BASE || 'http://localhost:3000').replace(/\/+$|\/$/, '');
  map[url] = `${base}/seed-images/${filename}`;
      downloaded++;
      continue;
    }

    try {
      await downloadToFile(url, dest);
      const base = (process.env.NEXT_PUBLIC_SEED_IMAGE_BASE || 'http://localhost:3000').replace(/\/+$|\/$/, '');
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

// end

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
