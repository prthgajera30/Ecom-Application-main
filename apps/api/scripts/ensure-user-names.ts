import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users: any[] = await prisma.user.findMany();
  for (const u of users) {
    const currentName = (u as any).name;
    if (!currentName || String(currentName).trim() === '') {
      const name = u.email ? String(u.email).split('@')[0] : 'User';
      console.log(`Updating user ${u.id} (${u.email}) -> name='${name}'`);
      // Use a raw query to avoid TypeScript Prisma client type issues in this helper
      await prisma.$executeRaw`UPDATE "User" SET "name" = ${name} WHERE id = ${u.id}`;
    }
  }
  console.log('Done updating user names.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
