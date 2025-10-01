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

- Web (Next.js): http://localhost:3000
- API (Express): http://localhost:4000/api
- Recs (Flask): http://127.0.0.1:5000/health

## Docker (prod-like) startup

```bash
docker compose -f infra/docker-compose.yml --project-name ecommerce up --build
```

## Scripts

```bash
# Seed demo data in local dev
yarn seed # or pnpm seed

# Run tests
pnpm -r test
```

See `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/RUNBOOK.md`.

## Environments

Copy `infra/.env.example` to `.env` for local overrides if needed. Secrets should be injected via environment (not committed).
