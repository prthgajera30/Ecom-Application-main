# E-commerce Personalization Monorepo

This repository houses the personalized commerce API (Node + Prisma + Mongo), Next.js storefront, and optional Python recommendation service. It is designed to work immediately after cloning: run a single setup command and you are ready to develop.

## Quick start

### macOS / Linux
```bash
corepack enable
pnpm run setup
pnpm run dev
```

### Windows (PowerShell)
```powershell
corepack enable
pnpm run setup
pnpm run dev
```

> `pnpm run dev` starts the API on port 4000 and the web app on port 3000. The recommendation service is optional and can be launched manually (see below).

## Requirements

- **Node.js 20+** (the repo ships an `.nvmrc`, `package.json` `engines`, and Volta pin to keep versions consistent)
- **pnpm 9** via Corepack (`corepack enable` prepares pnpm automatically)
- **Docker Desktop** (or compatible Docker Engine) for PostgreSQL/Mongo containers
- **Git long path support on Windows**: `git config --system core.longpaths true` and enable *Enable Win32 long paths* in Group Policy (`gpedit.msc`)

## What `pnpm run setup` does

1. Enables Corepack and makes sure pnpm 9.12.3 is available
2. Installs every workspace dependency (`pnpm install --recursive`)
3. Creates `.env`, `apps/api/.env`, and `apps/web/.env` from their `.example` templates if they do not exist
4. On the very first run, clears any existing Docker volumes to avoid credential mismatches, then spins up PostgreSQL and MongoDB via `docker compose up -d db mongo` (if Docker is available; otherwise it reminds you to start your own services)
5. Waits for PostgreSQL to pass health checks (`scripts/db-wait.{sh,ps1}`) or confirms the TCP port is open when you are running a local database
6. Generates Prisma clients across the workspace (`pnpm -r --if-present prisma:generate`)
7. Applies database migrations for the API (`pnpm --filter @apps/api prisma:migrate`)
8. Seeds demo data the first time only, then writes `.first-run-done` to skip future seeds
9. Prints the next step: `pnpm run dev`

During the first run, if Prisma reports an authentication (`P1000`) or migration (`P3018`) error the setup scripts automatically reset the Docker Postgres volume and retry once. Set `AUTO_RESET_DB_ON_P1000=0` (or `false`) before running the script to opt out of this behavior.

Seeding is **idempotent**. Delete `.first-run-done` if you want to re-seed.

## Environment configuration

- **Root `.env`**: created from `.env.example`. Holds shared values (`DATABASE_URL`, `MONGO_URL`, port defaults, `NEXT_PUBLIC_API_BASE`, etc.).
- **API `.env`** (`apps/api/.env`): overrides for Prisma, Mongo, Stripe secrets, and the API port. Template at `apps/api/.env.example`.
- **Web `.env`** (`apps/web/.env`): public configuration for the Next.js app. Template at `apps/web/.env.example`.

If you edit a template, re-run `pnpm run setup` (or copy the files manually) to propagate new keys.

## Common commands

| Command | Description |
| --- | --- |
| `pnpm run setup` | End-to-end bootstrap (install, DB up, migrate, first-run seed) |
| `pnpm run dev` | Start API and web apps concurrently |
| `pnpm run build` | Build every workspace that defines a `build` script |
| `pnpm run lint` | Run linters for packages that define a `lint` script |
| `pnpm run db:up` | Launch Postgres and Mongo containers (`docker compose`) |
| `pnpm run db:wait` | Wait for the Postgres container to become healthy |
| `pnpm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `pnpm run db:seed` | Run the idempotent Prisma + Mongo seed |
| `pnpm run migrate` | Convenience wrapper that starts Docker (when available) then runs migrations + seed |
| `pnpm run first-run` | Run migrations and seed only if `.first-run-done` is missing |

### API package scripts

Inside `apps/api`:

- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`
- `pnpm prisma:studio`

### Web package scripts

Inside `apps/web`:

- `pnpm dev`
- `pnpm build`
- `pnpm start`

## Optional recommendations service

The Python service in `apps/recs` is optional. To experiment with it:

1. Run `pnpm run dev:recs` (this script will create a virtual environment, install requirements when they change, and start Flask).
2. Update `RECS_URL` in your env files if you change the host/port.

## Troubleshooting

- **Docker is not running / port already in use**: make sure Docker Desktop is started and no other Postgres/Mongo instances occupy ports 5432/27017. If you prefer local database services, start them manually before running `pnpm run setup` and the script will skip Docker.
- **`pnpm run setup` fails waiting for Postgres**: `docker compose logs db` to inspect container logs; remove the `postgres_data` volume if initialization failed.
- **`pnpm run setup` fails with Prisma error P1000 (authentication) or P3018 (migration failure)**: on the first run the script automatically resets the Docker Postgres volume and retries once. If it still fails (or you disabled this via `AUTO_RESET_DB_ON_P1000=0`), align `DATABASE_URL` with the running instance, inspect the SQL in `apps/api/prisma/migrations`, or manually reset the volume with `docker compose down --volumes` before rerunning setup.
- **Need to re-run the seed**: delete `.first-run-done` and re-run `pnpm run first-run` (or `pnpm run setup`).
- **Cleanup install issues**: `pnpm store prune && rm -rf node_modules pnpm-lock.yaml && pnpm install --recursive`.
- **Windows path errors**: ensure long paths are enabled (see Requirements section).

## Repository structure

```
apps/
  api/    # Node API + Prisma (Postgres) + MongoDB models
  web/    # Next.js 14 storefront
  recs/   # Optional Python recommendation service
packages/
  ui/     # Shared React components
  config/ # Shared tooling configuration
  scripts/  # Cross-platform automation (setup, db-wait, migrate-and-seed)
```

Happy hacking!
