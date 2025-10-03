# E-commerce Personalization Monorepo

One-command dev environment for a real-time personalized e-commerce app: Next.js storefront, Node.js API gateway, Flask recommendations microservice, PostgreSQL, MongoDB, Stripe Checkout, and Socket.IO.

## Quick start (local dev without Docker)

Prereqs: Node 20 + pnpm, Python 3.11, local PostgreSQL and MongoDB running.

```bash
cd ecommerce-personalization
pnpm install
# Create local envs (copy examples and adjust as needed)
# apps/api/.env -> see values in infra/.env.example but use localhost
# apps/web/.env -> NEXT_PUBLIC_API_BASE=http://127.0.0.1:4000/api

# Start services in parallel (API, Web, Recs):
pnpm dev

# In another terminal, apply migrations and seed
pnpm migrate
pnpm seed
```

- If this is your first run, make sure PostgreSQL and MongoDB are reachable before invoking `pnpm migrate`. For a zero-config setup, you can start the databases via Docker with `docker compose -f infra/docker-compose.yml up postgres mongo -d`.

- Web (Next.js): http://localhost:3000
- API (Express): http://localhost:4000/api
- Recs (Flask): http://127.0.0.1:5000/health

## Docker (prod-like) startup

### Manual compose

```bash
docker compose -f infra/docker-compose.yml --project-name ecommerce up --build
```

### Scripted bootstrap (rebuilds, migrates, seeds)

```bash
# Dev stack (port 80 via nginx)
./scripts/bootstrap.sh

# Production-style stack (nginx on :8085)
./scripts/bootstrap.sh --prod

# Optional flags
#   --no-build  skip docker compose build
#   --no-seed   skip demo data
```

## Scripts

```bash
# Seed demo data in local dev
yarn seed # or pnpm seed

# Run tests
pnpm -r test
```

### Seeding demo data

The seeding script lives at `scripts/seed.ts` and is wired to the root `pnpm seed` command. It wipes and repopulates the MongoDB
catalog and Prisma-backed PostgreSQL tables with demo products, events, and two ready-to-use accounts:

- Admin: `admin@example.com` / `admin123`
- Customer: `user@example.com` / `user123`

Before running the seed, ensure the API environment variables point at reachable PostgreSQL and MongoDB instances (the script
defaults to `MONGO_URL=mongodb://localhost:27017/shop` if unset) and apply the latest migrations:

```bash
pnpm migrate
pnpm seed          # or pnpm --filter ./apps/api run seed
```

The operation is idempotent—re-running it will clear the existing demo data and load a fresh set.

See `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/RUNBOOK.md`.

## Environments

Copy `infra/.env.example` to `.env` for local overrides if needed. Secrets should be injected via environment (not committed).
