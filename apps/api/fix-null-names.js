const { PrismaClient } = require('@prisma/client');

async function fixNullNames() {
  const prisma = new PrismaClient();

  try {
    console.log('Finding users with null names...');
    const usersWithNullNames = await prisma.user.findMany({
      where: { name: null }
    });

    console.log(`Found ${usersWithNullNames.length} users with null names`);

    for (const user of usersWithNullNames) {
      const name = user.email.split('@')[0];
      console.log(`Updating ${user.email} to name: ${name}`);

      await prisma.user.update({
        where: { id: user.id },
        data: { name: name }
      });
    }

    console.log('Done fixing null names!');

    // Recheck all users
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });

    console.log('\nAll users after fix:');
    allUsers.forEach(user => {
      console.log(`- Email: ${user.email}, Name: ${user.name || 'No name'}`);
    });

  } catch (error) {
    console.error('Error fixing null names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixNullNames();
