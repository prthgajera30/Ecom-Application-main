# Runbook

- Bootstrap local environment: `pnpm run setup`
- Start dev servers (API + web): `pnpm run dev`
- Apply migrations only: `pnpm run db:migrate`
- Seed data idempotently: `pnpm run db:seed`
- Inspect database: `pnpm --filter @apps/api prisma:studio`
- Tear down databases: `docker compose down`
- Container logs (if using Docker): `docker compose logs -f db` / `docker compose logs -f mongo`
