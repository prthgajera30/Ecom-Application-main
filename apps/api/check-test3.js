const { PrismaClient } = require('@prisma/client');

async function checkTest3() {
  const prisma = new PrismaClient();

  try {
    console.log('Looking for test3@example.com...');
    // Only select fields that won't cause type issues
    const users = await prisma.user.findMany({
      where: { email: { contains: 'test3' } },
      select: { id: true, email: true }
    });

    console.log('Users found:', users);

    if (users.length > 0) {
      // Try to get the name with raw SQL
      const userId = users[0].id;
      const rawResult = await prisma.$queryRaw`
        SELECT id, email, name FROM "User" WHERE id = ${userId}
      `;
      console.log('Raw query result:', rawResult);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTest3();
