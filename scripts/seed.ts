
import { prisma } from '../apps/api/src/db';
import { connectMongo, Product, Category } from '../apps/api/src/db';
import bcrypt from 'bcryptjs';

async function main() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/shop';
  await connectMongo(mongoUrl);

  await Product.deleteMany({});
  await Category.deleteMany({});

  const categories = await Category.insertMany([
    { name: 'Shoes', slug: 'shoes' },
    { name: 'Bags', slug: 'bags' },
    { name: 'Watches', slug: 'watches' },
    { name: 'Hats', slug: 'hats' },
    { name: 'Accessories', slug: 'accessories' },
  ]);

  const brands = ['Pulse Gear', 'Aether Athletics', 'Northwind Supply', 'Beacon Street', 'Horizon Collective'];
  const materials = ['Recycled mesh', 'Full-grain leather', 'Performance knit', 'Organic cotton', 'Lightweight alloy'];
  const countries = ['USA', 'Portugal', 'Vietnam', 'Italy', 'Spain'];
  const colors = ['Black', 'White', 'Navy', 'Scarlet', 'Olive'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  const placeholder = (seed: string | number, size = 600) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

  const products: any[] = [];
  for (let i = 1; i <= 20; i++) {
    const cat = categories[i % categories.length];
    const brand = brands[i % brands.length];
    const material = materials[i % materials.length];
    const origin = countries[i % countries.length];
    const productColors = [colors[i % colors.length], colors[(i + 2) % colors.length]];
    const productSizes = sizes.slice((i % 2), (i % 2) + 3);
    const basePrice = 950 + i * 75;

    const variants: any[] = [];
    let totalStock = 0;
    productColors.forEach((color, colorIdx) => {
      productSizes.forEach((size, sizeIdx) => {
        const variantId = `product-${i}-${color.toLowerCase()}-${size.toLowerCase()}`;
        const variantPrice = basePrice + colorIdx * 50 + sizeIdx * 25;
        const stock = 6 + ((i + colorIdx + sizeIdx) % 12);
        totalStock += stock;
        variants.push({
          variantId,
          sku: `SKU-${i}-${colorIdx}${sizeIdx}`,
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
    const rating = { average: Number((3.6 + (i % 12) * 0.1).toFixed(1)), count: 20 + i * 3 };
    const badges: string[] = [];
    if (i % 3 === 0) badges.push('Limited');
    if (i % 4 === 0) badges.push('Online only');

    products.push({
      title: `Product ${i}`,
      slug: `product-${i}`,
      description: `A versatile item designed for everyday use. Product ${i} mix-and-match variants help you find the perfect fit.`,
      longDescription: `Designed for performance and comfort, Product ${i} lets you move through your day with ease. Breathable construction keeps you cool while supportive materials deliver lasting durability. Pair it with your go-to basics or elevate the look with seasonal layers.`,
      brand,
      badges,
      images: [
        placeholder(`product-${i}-hero`),
        placeholder(`product-${i}-alt1`, 540),
        placeholder(`product-${i}-alt2`, 480),
      ],
      price: defaultVariant?.price || basePrice,
      currency: 'USD',
      categoryId: String(cat._id),
      stock: totalStock || 8,
      attributes: { brand, color: productColors[0], size: productSizes[0], material },
      variants,
      defaultVariantId: defaultVariant?.variantId,
      specs,
      rating,
    });
  }
  await Product.insertMany(products);

  const adminPass = await bcrypt.hash('admin123', 10);
  const userPass = await bcrypt.hash('user123', 10);
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { email: 'admin@example.com', passwordHash: adminPass, role: 'admin' } });
  const user = await prisma.user.create({ data: { email: 'user@example.com', passwordHash: userPass, role: 'customer' } });

  await prisma.event.deleteMany();
  await prisma.event.createMany({
    data: [
      { userId: user.id, type: 'view', payload: { productId: (products[0] as any)._id } as any },
      { userId: user.id, type: 'add_to_cart', payload: { productId: (products[1] as any)._id } as any },
      { userId: user.id, type: 'purchase', payload: { productId: (products[2] as any)._id } as any },
    ],
  });

  console.log('Seed completed');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
