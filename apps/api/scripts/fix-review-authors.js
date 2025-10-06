const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.review.findMany({ where: { userId: { not: null } } });
  for (const r of reviews) {
    if (!r.authorName && r.userId) {
      const user = await prisma.user.findUnique({ where: { id: r.userId } });
      const name = (user && (user.name || user.email.split('@')[0])) || null;
      const email = (user && user.email) || null;
      if (name || email) {
        console.log(`Updating review ${r.id} -> authorName=${name} authorEmail=${email}`);
        await prisma.review.update({ where: { id: r.id }, data: { authorName: name, authorEmail: email } });
      }
    }
  }
  console.log('Done fixing review authors');
}

main().catch(e => { console.error(e); process.exit(1); });
