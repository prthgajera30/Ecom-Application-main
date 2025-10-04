import mongoose from 'mongoose';

import { prisma } from '../src/db';
import { seedAll } from '../src/seeding';

async function main() {
  await seedAll();
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
