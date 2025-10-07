const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Try to load .env from multiple possible locations
const possibleEnvPaths = [
  path.resolve(__dirname, '../apps/api/.env'),      // From scripts/
  path.resolve(process.cwd(), 'apps/api/.env'),    // From project root
  path.resolve(process.cwd(), '.env'),              // From project root
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    console.log(`Loaded .env from: ${envPath}`);
    break;
  }
}

if (!envLoaded) {
  console.log('Warning: No .env file found, using defaults');
}

// Allow MONGO_URL override from command line or environment
const mongoUrl = process.env.MONGO_URL || process.argv[2] || DEFAULT_MONGO;
const mongoose = require('mongoose');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const DEFAULT_MONGO = 'mongodb://localhost:27017/shop';

const categoryFallbacks = {
  footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
  apparel: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  outerwear: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  'gear-travel': 'https://images.unsplash.com/photo-1516205651411-aef33a44f7c2?auto=format&fit=crop&w=1200&q=80',
  'home-kitchen': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
  accessories: 'https://images.unsplash.com/photo-1517142874080-09548ab78358?auto=format&fit=crop&w=1200&q=80',
  wellness: 'https://images.unsplash.com/photo-1521540216272-a50305cd4421?auto=format&fit=crop&w=1200&q=80',
  tech: 'https://images.unsplash.com/photo-1542293787938-4d2226b05481?auto=format&fit=crop&w=1200&q=80',
};

const PLACEHOLDER_FALLBACK = 'https://placehold.co/1200x800?text=Image+Unavailable';

// cache of validated fallback per category
const validatedFallbacks = new Map();

async function getValidFallback(catSlug) {
  if (validatedFallbacks.has(catSlug)) {
    const cached = validatedFallbacks.get(catSlug);
    try {
      const chk = await urlExists(cached, 3000);
      if (chk.ok) return cached;
      // otherwise fall through to recompute
    } catch (e) {
      // fall through
    }
  }

  const candidates = [];
  if (categoryFallbacks[catSlug]) candidates.push(categoryFallbacks[catSlug]);
  // add all other configured fallbacks as secondary options
  for (const v of Object.values(categoryFallbacks)) {
    if (!candidates.includes(v)) candidates.push(v);
  }
  // final candidate: placeholder
  candidates.push(PLACEHOLDER_FALLBACK);

  for (const c of candidates) {
    try {
      const res = await urlExists(c, 4000);
      if (res.ok) {
        validatedFallbacks.set(catSlug, c);
        return c;
      }
    } catch (e) {
      // ignore and try next
    }
  }

  // if none worked (very unlikely), return the placeholder without validation
  validatedFallbacks.set(catSlug, PLACEHOLDER_FALLBACK);
  return PLACEHOLDER_FALLBACK;
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
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null }); });
      req.end();
    } catch (e) {
      resolve({ ok: false, status: null });
    }
  });
}

async function main() {
  const mongoUrl = process.env.MONGO_URL || DEFAULT_MONGO;
  const dryRun = process.argv.includes('--dry');

  console.log('Connecting to', mongoUrl);
  await mongoose.connect(mongoUrl, { autoIndex: false });

  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));
  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false, collection: 'categories' }));

  const categories = await Category.find({}).lean();
  const idToSlug = new Map(categories.map((c) => [String(c._id), c.slug]));

  // Precompute validated fallbacks for each category slug present in the DB
  const uniqueSlugs = new Set(Array.from(idToSlug.values()).filter(Boolean));
  for (const slug of uniqueSlugs) {
    const chosen = await getValidFallback(slug);
    console.log(`[fix-seed-images] validated fallback for category '${slug}': ${chosen}`);
  }

  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products. Scanning images...`);

  let changed = 0;
  const replacements = [];

  for (const p of products) {
    const slug = p.slug || String(p._id);
    const catSlug = idToSlug.get(String(p.categoryId)) || 'unknown';
  // pick a validated fallback (never a 404) - always revalidate via getValidFallback
  const fallback = await getValidFallback(catSlug);
    const images = Array.isArray(p.images) ? p.images : [];
    const newImages = [];
    let updatedProductImages = false;

    for (const url of images) {
      if (!url) continue;
      const res = await urlExists(url, 4000);
        if (res.ok) {
          newImages.push(url);
        } else {
          // double-check fallback before using it (should be valid from getValidFallback)
          const fbCheck = await urlExists(fallback, 3000);
          const finalFallback = fbCheck.ok ? fallback : PLACEHOLDER_FALLBACK;
          newImages.push(finalFallback);
          updatedProductImages = true;
          replacements.push({ slug, field: 'images', old: url, new: finalFallback, originalStatus: res.status, fallbackStatus: fbCheck.status });
          console.log(`Replacing ${slug} images ${url} -> ${finalFallback} (originalStatus=${res.status}, fallbackStatus=${fbCheck.status})`);
        }
    }

    // also check variant images if variants exist
    const variants = Array.isArray(p.variants) ? p.variants : [];
    let updatedVariants = false;
    const newVariants = [];
    for (const v of variants) {
      const vImages = Array.isArray(v.images) ? v.images : [];
      const newVImages = [];
      let vUpdated = false;
      for (const url of vImages) {
        if (!url) continue;
        const res = await urlExists(url, 4000);
        if (res.ok) {
          newVImages.push(url);
        } else {
          const fbCheck = await urlExists(fallback, 3000);
          const finalFallback = fbCheck.ok ? fallback : PLACEHOLDER_FALLBACK;
          newVImages.push(finalFallback);
          vUpdated = true;
          replacements.push({ slug, variantId: v.variantId, field: 'variant.images', old: url, new: finalFallback, originalStatus: res.status, fallbackStatus: fbCheck.status });
          console.log(`Replacing ${slug} variant ${v.variantId} ${url} -> ${finalFallback} (originalStatus=${res.status}, fallbackStatus=${fbCheck.status})`);
        }
      }
      const newVariant = Object.assign({}, v, { images: newVImages });
      newVariants.push(newVariant);
      if (vUpdated) updatedVariants = true;
    }

    if (updatedProductImages || updatedVariants) {
      const updateDoc = {};
      if (updatedProductImages) updateDoc.images = newImages;
      if (updatedVariants) updateDoc.variants = newVariants;
      if (!dryRun) {
        // dedupe images and prefer non-placeholder images before writing
        if (updateDoc.images) {
          const dedup = Array.from(new Set(updateDoc.images));
          const nonPlaceholder = dedup.filter((u) => u && u !== PLACEHOLDER_FALLBACK);
          updateDoc.images = (nonPlaceholder.length ? nonPlaceholder : dedup).slice(0, 6);
        }
        if (updateDoc.variants) {
          updateDoc.variants = updateDoc.variants.map((v) => {
            if (Array.isArray(v.images)) {
              const ded = Array.from(new Set(v.images));
              const nonp = ded.filter((u) => u && u !== PLACEHOLDER_FALLBACK);
              v.images = (nonp.length ? nonp : ded).slice(0, 6);
            }
            return v;
          });
        }
        await Product.updateOne({ _id: p._id }, { $set: updateDoc });
      }
      changed++;
    }
  }

  console.log(`Done. Products updated: ${changed}. Total replacements: ${replacements.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(2); });
