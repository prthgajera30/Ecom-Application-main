import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { prisma, Product, Category, connectMongo } from '../src/db';

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://localhost:27017/shop';

function objectIdFor(seed: string) {
  const hex = createHash('md5').update(seed).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

async function seedMongo() {
  await connectMongo(mongoUrl);

  const categorySeeds = [
    { name: 'Shoes', slug: 'shoes' },
    { name: 'Bags', slug: 'bags' },
    { name: 'Watches', slug: 'watches' },
    { name: 'Hats', slug: 'hats' },
    { name: 'Accessories', slug: 'accessories' },
  ].map((cat) => ({ ...cat, _id: objectIdFor(`category:${cat.slug}`) }));

  await Category.bulkWrite(
    categorySeeds.map((cat) => ({
      updateOne: {
        filter: { _id: cat._id },
        update: {
          $set: {
            name: cat.name,
            slug: cat.slug,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    })),
  );

  const brands = ['Pulse Gear', 'Aether Athletics', 'Northwind Supply', 'Beacon Street', 'Horizon Collective'];
  const materials = ['Recycled mesh', 'Full-grain leather', 'Performance knit', 'Organic cotton', 'Lightweight alloy'];
  const countries = ['USA', 'Portugal', 'Vietnam', 'Italy', 'Spain'];
  const colors = ['Black', 'White', 'Navy', 'Scarlet', 'Olive'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  const placeholder = (seed: string | number, size = 600) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

  const products = Array.from({ length: 20 }, (_, i) => {
    const index = i + 1;
    const slug = `product-${index}`;
    const productId = objectIdFor(`product:${slug}`);
    const category = categorySeeds[index % categorySeeds.length];
    const brand = brands[index % brands.length];
    const material = materials[index % materials.length];
    const origin = countries[index % countries.length];
    const productColors = [colors[index % colors.length], colors[(index + 2) % colors.length]];
    const productSizes = sizes.slice(index % 2, (index % 2) + 3);
    const basePrice = 950 + index * 75;

    const variants: Array<{
      variantId: string;
      sku: string;
      label: string;
      options: Record<string, string>;
      price: number;
      stock: number;
      images: string[];
    }> = [];
    let totalStock = 0;

    productColors.forEach((color, colorIdx) => {
      productSizes.forEach((size, sizeIdx) => {
        const variantId = `product-${index}-${color.toLowerCase()}-${size.toLowerCase()}`;
        const variantPrice = basePrice + colorIdx * 50 + sizeIdx * 25;
        const stock = 6 + ((index + colorIdx + sizeIdx) % 12);
        totalStock += stock;
        variants.push({
          variantId,
          sku: `SKU-${index}-${colorIdx}${sizeIdx}`,
          label: `${color} / ${size}`,
          options: { color, size },
          price: variantPrice,
          stock,
          images: [
            placeholder(`${variantId}-hero`),
            placeholder(`${variantId}-alt`, 540),
          ],
        });
      });
    });

    const defaultVariant = variants[0];
    const specs = [
      { key: 'Material', value: material },
      { key: 'Made in', value: origin },
      { key: 'Care', value: 'Machine wash cold. Line dry.' },
    ];
    const rating = { average: Number((3.6 + (index % 12) * 0.1).toFixed(1)), count: 20 + index * 3 };
    const badges: string[] = [];
    if (index % 3 === 0) badges.push('Limited');
    if (index % 4 === 0) badges.push('Online only');

    return {
      _id: productId,
      document: {
        title: `Product ${index}`,
        slug,
        description: `A versatile item designed for everyday use. Product ${index} mix-and-match variants help you find the perfect fit.`,
        longDescription: `Designed for performance and comfort, Product ${index} lets you move through your day with ease. Breathable construction keeps you cool while supportive materials deliver lasting durability.`,
        brand,
        badges,
        images: [
          placeholder(`product-${index}-hero`),
          placeholder(`product-${index}-alt1`, 540),
          placeholder(`product-${index}-alt2`, 480),
        ],
        price: defaultVariant?.price ?? basePrice,
        currency: 'USD',
        categoryId: category._id.toString(),
        stock: totalStock || 8,
        attributes: { brand, color: productColors[0], size: productSizes[0], material },
        variants,
        defaultVariantId: defaultVariant?.variantId,
        specs,
        rating,
      },
    };
  });

  await Product.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            ...product.document,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    })),
  );

  return products;
}

async function seedPostgres(productIds: string[]) {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash: adminPassword, role: 'admin' },
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'admin',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: { passwordHash: userPassword, role: 'customer' },
    create: {
      email: 'user@example.com',
      passwordHash: userPassword,
      role: 'customer',
    },
  });

  await prisma.event.upsert({
    where: { id: 'seed-event-view' },
    update: {
      userId: customer.id,
      payload: { productId: productIds[0] },
      type: 'view',
    },
    create: {
      id: 'seed-event-view',
      userId: customer.id,
      payload: { productId: productIds[0] },
      type: 'view',
    },
  });

  await prisma.event.upsert({
    where: { id: 'seed-event-cart' },
    update: {
      userId: customer.id,
      payload: { productId: productIds[1] },
      type: 'add_to_cart',
    },
    create: {
      id: 'seed-event-cart',
      userId: customer.id,
      payload: { productId: productIds[1] },
      type: 'add_to_cart',
    },
  });

  await prisma.event.upsert({
    where: { id: 'seed-event-purchase' },
    update: {
      userId: customer.id,
      payload: { productId: productIds[2] },
      type: 'purchase',
    },
    create: {
      id: 'seed-event-purchase',
      userId: customer.id,
      payload: { productId: productIds[2] },
      type: 'purchase',
    },
  });

  return { admin, customer };
}

async function main() {
  const products = await seedMongo();
  const productIds = products.slice(0, 3).map((product) => product._id.toString());
  await seedPostgres(productIds);
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
