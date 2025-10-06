const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();

  try {
    console.log('Checking users in database...');
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    console.log('Users found:', users);

    if (users.length === 0) {
      console.log('No users found in database');
    } else {
      console.log(`Found ${users.length} users:`);
      users.forEach(user => {
        console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.name || 'No name'}`);
      });
    }

    // Test specific user lookup
    const testUserId = '8a0d1c3b-19a4-49ed-82d0-0712a0d4791d';
    console.log(`\nTesting lookup for user ID: ${testUserId}`);
    try {
      const testUser = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { id: true, email: true, name: true }
      });
      if (testUser) {
        console.log('Test user found:', testUser);
      } else {
        console.log('Test user NOT found in database');
      }
    } catch (testError) {
      console.error('Error looking up test user:', testError);
    }

  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
