const { PrismaClient } = require('@prisma/client');

async function checkTest6() {
  const prisma = new PrismaClient();

  try {
    console.log('Looking for test6@example.com...');
    const users = await prisma.user.findMany({
      where: { email: { contains: 'test6' } },
      select: { id: true, email: true }
    });

    console.log('Users found:', users);

    if (users.length > 0) {
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

checkTest6();
