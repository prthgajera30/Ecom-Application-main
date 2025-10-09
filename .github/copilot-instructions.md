## Quick orientation for AI assistants

This monorepo implements an e-commerce personalization stack with three main runtimes:
- `apps/api/` — Express + TypeScript API (Prisma + Postgres for relational data; Mongoose + Mongo for product/catalog/session data).
- `apps/web/` — Next.js storefront (app router). Client helpers live in `apps/web/lib` and UI components under `apps/web/components`.
- `apps/recs/` — Optional Flask recommender service (ingest and recommendation HTTP endpoints).

Keep changes small and focused. This doc highlights the important files, conventions, and commands an AI coding agent should know to be immediately productive.

Key files & places to look
- API entry: `apps/api/src/index.ts` (Socket.IO setup, route registration).
- DB layers: `apps/api/src/db.ts` (Prisma client + Mongoose schemas for Product, Category, Session).
- API routes: `apps/api/src/routes/*.ts` and business logic in `apps/api/src/services/`.
- Web app entry & important utilities: `apps/web/app/page.tsx` (home), `apps/web/app/(shop)/products/page.tsx` (catalog), `apps/web/lib/api.ts` (apiGet/apiPost wrappers), and `apps/web/components/ui/ProductCard.tsx` (product rendering patterns).
- Recs service: `apps/recs/app.py` (endpoints `/ingest/events`, `/recommendations`).

Big-picture & integration notes
- Data split: relational data (Orders, Users, Payments) live in Postgres/Prisma; product catalog and session-like ephemeral data are stored in Mongo via Mongoose. See `apps/api/src/db.ts`.
- Recommendations are optional and called via `RECS_URL`; the API exposes `/api/recommendations` (see `apps/api/src/routes/recs.ts` and `apps/api/src/services/recs.ts`).
- Frontend talks to the API via `NEXT_PUBLIC_API_BASE` (set per-deployment). The web client uses `apps/web/lib/api.ts` — be careful with cross-origin and local hostnames (the repo contains logic to normalize the base URL).
- Real-time flows use Socket.IO with room conventions `session:{id}` and `user:{id}` (see server setup in `apps/api/src/index.ts`).

Developer workflows & commands (run from repo root)
- Bootstrap (install deps, DB, migrations, seed):
  - pnpm run setup
  - This runs pnpm installs, spins helper DB containers (docker compose), runs Prisma migrations, generates client, and seeds demo data (idempotent seed). Look at `scripts/migrate-and-seed.*` if you need to adapt.
- Start local dev (concurrently):
  - pnpm run dev  # launches API + web (and recs optionally)
- Build the storefront (useful verification):
  - pnpm --filter @apps/web build
- Prisma operations (API-only):
  - pnpm --filter @apps/api prisma:migrate
  - pnpm --filter @apps/api prisma:generate
- Tests:
  - API tests: cd apps/api && pnpm test (Jest)
  - Web e2e: pnpm --filter @apps/web test (Playwright)

Conventions & patterns worth following
- Hybrid persistence: when changing relational models use Prisma migrations + `prisma:generate`. When changing catalog/schema for Mongo edit `apps/api/src/db.ts` and update seeds.
- Thin API services + route layers: follow `routes/*.ts` calling into `services/*` for business logic. Routes often use Zod for validation.
- Client API wrapper: `apps/web/lib/api.ts` centralizes fetch headers (auth, session) and error handling — change it carefully. It currently defaults to `cache: 'no-store'` for client requests.
- UI & product patterns: product display and quick-add flows are centered in `apps/web/components/ui/ProductCard.tsx` and `apps/web/context/CartContext`. Keep interactive controls out of anchor tags and prefer the `onQuickAdd` pattern.
- Styling: Tailwind is used across the app. Look for utility classes in components and shared `tailwind.config.ts`.

Integration gotchas and tips
- NEXT_PUBLIC_API_BASE: when switching environments, update `apps/web/.env` (or root `.env`) and rebuild the web app for production bundles.
- Seeds & first-run: the seed runner writes `.first-run-done` to avoid reseeding. When editing `seed.ts` re-run the seeding scripts in `apps/api/prisma/` and the runtime `apps/api/src/seeding.ts` as needed.
- CI differences: CI workflow references an upstream path in some scripts — prefer running package-specific scripts locally rather than relying on CI root paths.

Safety rules for automated edits
- Prefer small, self-contained changes in `apps/*` or `packages/*` that are covered by tests or simple to build.
- If a change touches DB schemas, add a Prisma migration and run `prisma:generate`. If you change Mongo schemas, update seeds.
- When changing public routes or JSON contracts, update example env files and `docs/API_CONTRACTS.md` where applicable.

If you want, I can expand any of the above sections with specific code examples (route -> service traces, sample migration flow, or a checklist for PRs). Reply with which area to expand.
