import { execSync } from 'node:child_process';

try {
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', cwd: 'apps/api' });
  console.log('Migrations applied');
} catch (e) {
  console.error('Migration failed', e);
  process.exit(1);
}
