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

  const placeholder = (i: number) => `https://picsum.photos/seed/shop-${i}/600/600`;

  const products = [] as any[];
  for (let i = 1; i <= 20; i++) {
    const cat = categories[i % categories.length];
    products.push({
      title: `Product ${i}`,
      slug: `product-${i}`,
      description: `Description for product ${i}`,
      images: [placeholder(i), placeholder(i + 100)],
      price: 1000 + i * 50,
      currency: 'USD',
      categoryId: String(cat._id),
      stock: 20 + (i % 10),
      attributes: { color: ['black','white','blue'][i % 3], size: ['S','M','L'][i % 3] },
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
