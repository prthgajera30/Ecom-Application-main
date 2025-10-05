const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

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
          // picsum.photos responds to GET but may reject HEAD with 405; treat 405 as acceptable here
          const ok = (res.statusCode >= 200 && res.statusCode < 400) || res.statusCode === 405;
          resolve({ ok, status: res.statusCode });
        },
      );
      req.on('error', () => resolve({ ok: false, status: null }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null }); });
      req.end();
    } catch (e) {
      resolve({ ok: false, status: null });
    }
  });
}

(async function main() {
  const file = path.resolve(__dirname, '..', 'apps', 'api', 'src', 'seeding.ts');
  const text = fs.readFileSync(file, 'utf8');

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
          // collect until closing ]
          let k = j + 1;
          let acc = [];
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

  // dedupe urls and check
  let total = 0;
  const failures = [];
  for (const p of products) {
    for (const url of p.images) {
      total++;
      const res = await urlExists(url, 5000);
      if (!res.ok) {
        failures.push({ slug: p.slug, url, status: res.status });
        console.log(`BAD: ${p.slug} -> ${url} (status=${res.status})`);
      }
    }
  }

  console.log(`Checked ${total} images across ${products.length} products. Failures: ${failures.length}`);
  if (failures.length === 0) process.exit(0);
  process.exit(1);
})();
