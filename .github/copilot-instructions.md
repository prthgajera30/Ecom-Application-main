## Quick orientation for AI assistants

This monorepo is an e-commerce personalization stack: a Node API (Prisma + Postgres + Mongo),
a Next.js storefront, and an optional Python recommendation service. Use these notes to make
targeted, low-risk edits and to run or test features locally.

Key directories (examples you can open):
- `apps/api/` — Express + TypeScript API. Entry: `apps/api/src/index.ts`.
- `apps/web/` — Next.js storefront (app dir). Client API utilities: `apps/web/lib/api.ts`.
- `apps/recs/` — Optional Flask recommender `apps/recs/app.py` (HTTP endpoints `/ingest/events`, `/recommendations`).
- `apps/api/prisma/` — Prisma schema and migrations. Migrations live under `apps/api/prisma/migrations/`.
- `apps/api/src/db.ts` — Prisma client + Mongoose models (Product, Category, Session).
- `scripts/` — repo orchestration (setup, migrate-and-seed, run-dev helpers).

Big picture and integration points
- API persists relational data (Orders, Users, Payments) via Prisma/Postgres and product/catalog/session data in Mongo via Mongoose (`apps/api/src/db.ts`).
- The API calls the optional recs service via `RECS_URL` and exposes recommendation routes under `/api/recommendations` (`apps/api/src/routes/recs.ts` -> `services/recs.ts`).
- The storefront is configured at runtime by `NEXT_PUBLIC_API_BASE` (web env) and talks to the API; changing this requires rebuilding the `web` app when producing a production bundle.
- Real-time updates use Socket.IO (server set on `app.set('io')` in `apps/api/src/index.ts`) and room conventions like `session:{id}` and `user:{id}`.

Common developer workflows and important commands
- Bootstrap (install deps, DB, migrate, seed): `pnpm run setup` (run from repo root). This script:
  - installs workspace deps (pnpm), starts DB containers (docker compose), waits for DB, generates Prisma client and runs migrations, and seeds demo data. The seed is idempotent and controlled by `.first-run-done`.
- Start dev mode (concurrently): `pnpm run dev` (root) — launches `apps/api` and `apps/web` (and recs if enabled via `pnpm run dev:recs`).
- Generate/apply migrations: `pnpm --filter @apps/api prisma:migrate` and `pnpm --filter @apps/api prisma:generate`.
- Run API tests: `cd apps/api && pnpm test` (Jest). Recs tests: `cd apps/recs && pytest`.
- Docker compose stacks:
  - repo root `docker-compose.yml` — helper DB-only compose used by scripts (`ecom_postgres` / `ecom_mongo`).
  - `infra/docker-compose.yml` — full dev stack (nginx, web, api, recs).

Project-specific patterns and gotchas
- Monorepo uses pnpm workspaces and relies on `scripts/run-script.mjs` and `scripts/run-recs-dev.mjs` for deterministic dev bootstrapping.
- Prisma + Mongoose hybrid: modifications to Prisma models require `prisma migrate` and a regenerated client; changes to Mongo models live in `apps/api/src/db.ts` and don't affect Prisma.
- Seed: `apps/api/prisma/seed.ts` (invoked by `pnpm --filter @apps/api prisma:seed`) and `apps/api/src/seeding.ts` (runtime check). The repo uses an idempotent seed and writes `.first-run-done` to avoid reseeding.
- Environment files: `.env`, `apps/api/.env`, and `apps/web/.env` are created from `.example` templates by `pnpm run setup`. When changing keys add them to the examples and re-run setup.
- CI note: the workflow in `.github/workflows/ci.yml` references an upstream path `ecommerce-personalization/...` in its `cd` steps — be careful if mirroring CI runs locally; prefer running package-level scripts directly.

Where to look for examples when editing code
- Add or change an API route: follow `apps/api/src/routes/*.ts` and use `services/*` for business logic. Use Zod for validation (see `apps/api/src/routes/recs.ts`).
- Change product/session shapes: edit Mongoose schemas in `apps/api/src/db.ts` and update `apps/api/src/seeding.ts` to reflect demo data.
- Add a migration: update Prisma models in `apps/api/prisma/schema.prisma`, then `pnpm --filter @apps/api prisma:migrate` and ensure the client is generated.

Safety and low-risk edit rules for AI agents
- Prefer edits in `apps/*` and `packages/*` that include unit tests or are small, self-contained changes.
- When changing env names or public API shapes (routes / JSON contracts), update example env files and README where appropriate.
- If modifying DB schemas, add migrations and run `prisma:generate` — do not assume the client will auto-update.

If anything here is unclear or you'd like specific examples (test harnesses, common refactors, or a short checklist for PRs), tell me which area to expand and I'll iterate.
