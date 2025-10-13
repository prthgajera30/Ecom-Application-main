import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import http from 'http';
import https from 'https';
import { URL } from 'url';

import { prisma, Product, Category, connectMongo } from './db';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/shop';

const ADMIN_EMAIL = 'admin@example.com';
const CUSTOMER_EMAIL = 'user@example.com';

type SeedVariant = {
  variantId?: string;
  label: string;
  sku: string;
  price: number;
  stock: number;
  options: Record<string, string>;
  images: string[];
};

type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  brand: string;
  categorySlug: string;
  badges?: string[];
  images: string[];
  currency?: string;
  price: number;
  variants: SeedVariant[];
  specs?: { key: string; value: string }[];
  rating?: { average: number; count: number };
  attributes?: Record<string, string>;
};

async function loadKaggleData(): Promise<{ categories: { name: string; slug: string }[], products: SeedProduct[] }> {
  const csvPath = path.resolve(__dirname, '..', '..', '..', 'kaggle', 'data', 'fashion.csv');
  const categoriesMap = new Map<string, { name: string; slug: string }>();
  const products: SeedProduct[] = [];

  return new Promise((resolve, reject) => {
    const categories: { name: string; slug: string }[] = [];
    const stream = fs.createReadStream(csvPath).pipe(csv());

    stream.on('data', (row: any) => {
      const categoryKey = `${row.Category}-${row.SubCategory}`;
      if (!categoriesMap.has(categoryKey)) {
        const slug = categoryKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        categoriesMap.set(categoryKey, { name: categoryKey, slug });
      }

      const categorySlug = categoriesMap.get(categoryKey)!.slug;
      const productSlug = `kaggle-${row.ProductId}`;
      const price = Math.floor(Math.random() * 5000) + 1000; // Random price between 1000-6000

      products.push({
        slug: productSlug,
        title: row.ProductTitle,
        description: row.ProductTitle,
        longDescription: row.ProductTitle,
        brand: 'Fashion',
        categorySlug,
        images: [row.ImageURL],
        price,
        variants: [{
          variantId: `${productSlug}-${row.Colour.toLowerCase().replace(/\s+/g, '-')}`,
          label: row.Colour,
          sku: `KAG-${row.ProductId}`,
          price,
          stock: 10,
          options: { color: row.Colour },
          images: [row.ImageURL],
        }],
        attributes: {
          color: row.Colour,
          gender: row.Gender,
          usage: row.Usage,
        },
      });
    });

    stream.on('end', () => {
      categories.push(...Array.from(categoriesMap.values()));
      resolve({ categories, products });
    });

    stream.on('error', reject);
  });
}

// Image mapping and validation functions...
let seedImageMap: Record<string, string> | null = null;
try {
  const mapPath = path.resolve(__dirname, '..', 'seed-image-map.json');
  if (fs.existsSync(mapPath)) {
    seedImageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }
} catch (e) {
  seedImageMap = null;
}

function mapImage(url: string) {
  if (!url) return url;
  if (seedImageMap && seedImageMap[url]) return seedImageMap[url];

  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') return url;
    if (host.includes('picsum.photos') || host.includes('placehold.co')) return url;
  } catch (e) {
    // non-URL strings fall through
  }

  try {
    const seed = createHash('md5').update(url).digest('hex').slice(0, 10);
    return `https://picsum.photos/seed/${seed}/1200/800`;
  } catch (e) {
    return url;
  }
}

const PLACEHOLDER_IMAGE = 'https://picsum.photos/id/152/1200/800';

function objectIdFor(seed: string) {
  const hex = createHash('md5').update(seed).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

export async function seedMongo(mongoUrl = process.env.MONGO_URL ?? DEFAULT_MONGO_URL) {
  await connectMongo(mongoUrl);

  const { categories: categoriesData, products: productCatalog } = await loadKaggleData();

  const now = new Date();
  const categorySeeds = categoriesData.map((cat: { name: string; slug: string }, index: number) => ({
    ...cat,
    _id: objectIdFor(`category:${cat.slug}`),
    createdAt: new Date(now.getTime() + index),
    updatedAt: new Date(now.getTime() + index),
  }));

  await Category.deleteMany({});
  if (categorySeeds.length) {
    await Category.insertMany(categorySeeds, { ordered: true });
  }

  const categoryLookup = new Map(categorySeeds.map((cat: any) => [cat.slug, cat]));

  // Simplified image validation for this fix
  const categoryFallbacks: Record<string, string> = {
    footwear: 'https://picsum.photos/id/142/1200/800',
    clothing: 'https://picsum.photos/id/143/1200/800',
    outerwear: 'https://picsum.photos/id/144/1200/800',
    'bags-luggage': 'https://picsum.photos/id/145/1200/800',
    'home-kitchen': 'https://picsum.photos/id/146/1200/800',
    electronics: 'https://picsum.photos/id/147/1200/800',
    'sports-outdoors': 'https://picsum.photos/id/148/1200/800',
    'beauty-personal-care': 'https://picsum.photos/id/149/1200/800',
    accessories: 'https://picsum.photos/id/150/1200/800',
    jewelry: 'https://picsum.photos/id/151/1200/800',
  };

  // Simplified resolveImages
  async function resolveImages(urls?: string[], categorySlug?: string, productSlug?: string, variantId?: string) {
    const fallback = categoryFallbacks[categorySlug || ''] || categoryFallbacks.footwear;
    return urls && urls.length > 0 ? urls : [
      `https://picsum.photos/seed/${productSlug || 'product'}-0/1200/800`,
      `https://picsum.photos/seed/${productSlug || 'product'}-1/1200/800`,
      `https://picsum.photos/seed/${productSlug || 'product'}-2/1200/800`
    ].slice(0, 3);
  }

  const productDocuments = [];
  for (const [index, product] of productCatalog.entries()) {
    const category = categoryLookup.get(product.categorySlug);
    if (!category) {
      throw new Error(`Seed configuration error: category ${product.categorySlug} not found for product ${product.slug}`);
    }

    const resolvedProductImages = await resolveImages(product.images, product.categorySlug, product.slug);

    const variants = [];
    for (const variant of product.variants) {
      const resolvedId = variant.variantId || `${product.slug}-${Object.values(variant.options).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const resolvedVariantImages = await resolveImages(variant.images, product.categorySlug, product.slug, variant.variantId);

      variants.push({
        variantId: resolvedId,
        sku: variant.sku,
        label: variant.label,
        options: variant.options,
        price: variant.price,
        stock: variant.stock,
        images: resolvedVariantImages,
      });
    }

    const totalStock = variants.reduce((sum, entry) => sum + (entry.stock || 0), 0);
    const defaultVariantId = variants[0]?.variantId;

    const baseAttributes = {
      brand: product.brand,
      ...product.attributes,
      ...(variants[0]?.options?.color ? { color: variants[0].options.color } : {}),
      ...(variants[0]?.options?.size ? { size: variants[0].options.size } : {}),
    };
    const attributes = Object.fromEntries(
      Object.entries(baseAttributes).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    productDocuments.push({
      _id: objectIdFor(`product:${product.slug}`),
      title: product.title,
      slug: product.slug,
      description: product.description,
      longDescription: product.longDescription,
      brand: product.brand,
      badges: product.badges ?? [],
      images: resolvedProductImages,
      price: variants[0]?.price ?? product.price,
      currency: product.currency ?? 'USD',
      categoryId: category._id.toString(),
      stock: totalStock || 12,
      attributes,
      variants,
      defaultVariantId,
      specs: product.specs ?? [],
      rating: product.rating ?? { average: 4.4, count: 24 },
    });
  }

  await Product.deleteMany({});
  if (productDocuments.length) {
    await Product.insertMany(
      productDocuments.map((product, index) => ({
        ...product,
        createdAt: new Date(now.getTime() + index),
        updatedAt: new Date(now.getTime() + index),
      })),
      { ordered: true }
    );
  }

  console.log(`[seed] Upserted ${categoriesData.length} categories and ${productDocuments.length} products in MongoDB.`);
  return productDocuments.map((product) => String(product._id));
}

export async function seedPostgres(productIds: string[]) {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  // Check for existing admin user instead of upsert
  let existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  let admin;
  if (existingAdmin) {
    admin = await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: {
        passwordHash: adminPassword,
        role: 'admin',
        name: existingAdmin.name || 'Admin User' // ensure name is set
      }
    });
  } else {
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: adminPassword,
        role: 'admin',
        name: 'Admin User',
      },
    });
  }

  // Check for existing customer user instead of upsert
  let existingCustomer = await prisma.user.findUnique({ where: { email: CUSTOMER_EMAIL } });
  let customer;
  if (existingCustomer) {
    customer = await prisma.user.update({
      where: { email: CUSTOMER_EMAIL },
      data: {
        passwordHash: userPassword,
        role: 'customer',
        name: existingCustomer.name || 'Demo Customer' // ensure name is set
      }
    });
  } else {
    customer = await prisma.user.create({
      data: {
        email: CUSTOMER_EMAIL,
        passwordHash: userPassword,
        role: 'customer',
        name: 'Demo Customer',
      },
    });
  }

  if (productIds.length >= 3) {
    await prisma.event.upsert({
      where: { id: 'seed-event-view' },
      update: { userId: customer.id, payload: { productId: productIds[0] }, type: 'view' },
      create: { id: 'seed-event-view', userId: customer.id, payload: { productId: productIds[0] }, type: 'view' },
    });

    await prisma.event.upsert({
      where: { id: 'seed-event-cart' },
      update: { userId: customer.id, payload: { productId: productIds[1] }, type: 'add_to_cart' },
      create: { id: 'seed-event-cart', userId: customer.id, payload: { productId: productIds[1] }, type: 'add_to_cart' },
    });

    await prisma.event.upsert({
      where: { id: 'seed-event-purchase' },
      update: { userId: customer.id, payload: { productId: productIds[2] }, type: 'purchase' },
      create: { id: 'seed-event-purchase', userId: customer.id, payload: { productId: productIds[2] }, type: 'purchase' },
    });
  }

  // Create sample completed orders for admin dashboard
  if (productIds.length >= 3) {
    // Create sample order items and orders
    for (let i = 0; i < 5; i++) {
      const orderDate = new Date(Date.now() - (i * 86400000)); // One order per day for past 5 days

      await prisma.$transaction(async (tx) => {
        // Create order
        const order = await tx.order.create({
          data: {
            userId: customer.id,
            sessionId: `session-${i}`,
            subtotal: 14000 + i * 1000,
            taxAmount: Math.round((14000 + i * 1000) * 0.08),
            shippingAmount: 0, // Free shipping
            discountAmount: 0,
            total: 14000 + i * 1000 + Math.round((14000 + i * 1000) * 0.08),
            currency: 'USD',
            status: i === 0 ? 'paid' : 'paid', // All orders are paid to show reorder functionality
          },
        });

        // Create order items - use different products for each order
        const productsToUse = productIds.slice(i % 2, (i % 2) + 2).slice(0, 2);

        for (let j = 0; j < productsToUse.length; j++) {
          const productId = productsToUse[j];
          const price = 5000 + (j * 3000); // Varying prices

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: productId,
              title: `Sample Product ${j + 1}`,
              price: price,
              qty: j === 0 ? 2 : 1, // First item: 2 qty, second item: 1 qty
              variantId: null,
              variantLabel: null,
              variantOptions: undefined,
            },
          });
        }

        // Create payment record
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: order.total,
            status: 'paid',
            stripePaymentIntentId: `pi_demo_${order.id}`,
          },
        });
      });
    }
  }

  return { admin, customer };
}

export async function seedAll(options: { mongoUrl?: string } = {}) {
  const mongoUrl = options.mongoUrl ?? process.env.MONGO_URL ?? DEFAULT_MONGO_URL;
  const productIds = await seedMongo(mongoUrl);

  if (productIds.length < 3) {
    throw new Error(`Mongo seed only returned ${productIds.length} product IDs; expected at least 3 so Postgres seed can attach analytics events.`);
  }

  await seedPostgres(productIds.slice(0, 3));
  return { productIds };
}

export async function ensureDatabasesSeeded(options: { mongoUrl?: string } = {}) {
  const mongoUrl = options.mongoUrl ?? process.env.MONGO_URL ?? DEFAULT_MONGO_URL;

  await connectMongo(mongoUrl);

  const [categoryCount, productCount, adminCount, customerCount, eventCount] = await Promise.all([
    Category.estimatedDocumentCount().exec(),
    Product.estimatedDocumentCount().exec(),
    prisma.user.count({ where: { email: ADMIN_EMAIL } }),
    prisma.user.count({ where: { email: CUSTOMER_EMAIL } }),
    prisma.event.count({ where: { id: { in: ['seed-event-view', 'seed-event-cart', 'seed-event-purchase'] } } }),
  ]);

  const needsMongoSeed = categoryCount === 0 || productCount === 0;
  const needsPostgresSeed = adminCount === 0 || customerCount === 0 || eventCount < 3;

  if (!needsMongoSeed && !needsPostgresSeed) {
    return false;
  }

  await seedAll({ mongoUrl });
  return true;
}
