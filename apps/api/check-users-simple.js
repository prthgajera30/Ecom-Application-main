const { PrismaClient } = require('@prisma/client');

async function checkUsersSimple() {
  const prisma = new PrismaClient();

  try {
    console.log('Looking for test3@example.com...');
    const test3User = await prisma.user.findUnique({
      where: { email: 'test3@example.com' },
      select: { id: true, email: true, name: true }
    });

    if (test3User) {
      console.log('Found test3 user:', test3User);
      console.log('Name is:', test3User.name || 'NULL');
    } else {
      console.log('test3 user not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
    // Try a simple count
    try {
      const count = await prisma.user.count();
      console.log(`Total users: ${count}`);
    } catch (countError) {
      console.error('Count error:', countError.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkUsersSimple();
