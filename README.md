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

### Docker compose stacks and container names

The repository ships a few compose manifests that target different workflows. Use the right
container name when you `docker exec` into a service:

| Compose file | Stack purpose | Postgres container | Mongo container |
| --- | --- | --- | --- |
| `docker-compose.yml` (repo root) | Local database-only helper used by `pnpm run db:*` scripts | `ecom_postgres` | `ecom_mongo` |
| `infra/docker-compose.yml` | Full dev stack (Nginx, web, API, recs, databases) | `ecommerce_postgres` | `ecommerce_mongo` |
| `infra/docker-compose.prod.yml` | Production-like stack without explicit `container_name` overrides | `<project>_postgres_1` (for example `infra_postgres_1`) | `<project>_mongo_1` |

When you start the prod stack from the `infra/` directory, Docker derives the project name
from that folder. If you run it from elsewhere, override it with `--project-name` so you know
which container to inspect, e.g. `docker compose --project-name ecom-prod -f infra/docker-compose.prod.yml up -d`.

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
- **Isolating multiple Docker stacks on the same network**: when you run the compose setup on two machines simultaneously, make sure each host points at its own databases and API instance. Update the per-host env files (root `.env`, `apps/api/.env`, and `apps/web/.env`) so `DATABASE_URL`, `MONGO_URL`, and `NEXT_PUBLIC_API_BASE` use unique schema names/ports (for example, `shop_win` on port `5432/27017` vs. `shop_ubuntu` on `5433/27018`). Then adjust the compose manifests or overrides to publish distinct host ports for the API/web/DB containers and rebuild the storefront so it bakes in the correct `NEXT_PUBLIC_API_BASE` at build time. This prevents the Ubuntu storefront from accidentally calling the Windows API.
- **Remote browsers and `localhost`**: if the storefront bundle still contains `NEXT_PUBLIC_API_BASE=http://localhost:4000/api`, any shopper hitting the site from another machine will see empty product lists because their browser tries to reach `localhost`. The client now auto-detects this mismatch and falls back to `/api` (proxied through Nginx), but you should still rebuild the `web` image with an origin that remote browsers can reach (for example, `/api` or `http://your-host:8085/api`).

### Example per-host env files

When you are running the Docker stacks on two different machines (for example Windows and Ubuntu on the same network), keep a dedicated copy of each env file per host. The templates below are based on `.env.example`, `apps/api/.env.example`, and `apps/web/.env.example`; adjust the hostnames to match your LAN and keep secrets (`JWT_SECRET`, Stripe keys, etc.) unique per environment.

#### Windows host (`.env.win`, `apps/api/.env.win`, `apps/web/.env.win`)

```env
# Root .env.win
DB_HOST=localhost
DB_PORT=5432
DB_USER=ecom
DB_PASSWORD=ecom
DB_NAME=shop_win

DATABASE_URL=postgresql://ecom:ecom@localhost:5432/shop_win?schema=public
MONGO_URL=mongodb://localhost:27017/shop_win

API_PORT=4000
WEB_PORT=3000

NEXT_PUBLIC_API_BASE=http://windows-host.local/api
RECS_URL=http://windows-host.local:5000
```

```env
# apps/api/.env.win
DATABASE_URL="postgresql://ecom:ecom@postgres:5432/shop_win?schema=public"
MONGO_URL="mongodb://mongo:27017/shop_win"
PORT=4000

JWT_SECRET="dev-change-me"
STRIPE_SECRET_KEY="sk_test_example"
STRIPE_WEBHOOK_SECRET="whsec_example"
RECS_URL="http://recs:5000"
```

```env
# apps/web/.env.win
NEXT_PUBLIC_API_BASE=http://windows-host.local/api
```

Publish the default compose stack (`docker compose up`) or expose the API/web services on host ports `4000`/`3000` so the Windows machine owns the canonical `shop_win` datasets.

#### Ubuntu host (`.env.ubuntu`, `apps/api/.env.ubuntu`, `apps/web/.env.ubuntu`)

```env
# Root .env.ubuntu
DB_HOST=localhost
DB_PORT=5433
DB_USER=ecom
DB_PASSWORD=ecom
DB_NAME=shop_ubuntu

DATABASE_URL=postgresql://ecom:ecom@localhost:5433/shop_ubuntu?schema=public
MONGO_URL=mongodb://localhost:27018/shop_ubuntu

API_PORT=4001
WEB_PORT=3001

NEXT_PUBLIC_API_BASE=http://ubuntu-host.local:8085/api
RECS_URL=http://ubuntu-host.local:5001
```

```env
# apps/api/.env.ubuntu
DATABASE_URL="postgresql://ecom:ecom@postgres:5432/shop_ubuntu?schema=public"
MONGO_URL="mongodb://mongo:27017/shop_ubuntu"
PORT=4001

JWT_SECRET="dev-change-me"
STRIPE_SECRET_KEY="sk_test_example"
STRIPE_WEBHOOK_SECRET="whsec_example"
RECS_URL="http://recs:5000"
```

```env
# apps/web/.env.ubuntu
NEXT_PUBLIC_API_BASE=http://ubuntu-host.local:8085/api
```

Pair these env files with a compose override that remaps host ports, for example:

```yaml
# docker-compose.override.yml (Ubuntu)
services:
  api:
    ports:
      - "8085:4001"
  web:
    ports:
      - "8086:3001"
  db:
    ports:
      - "5433:5432"
  mongo:
    ports:
      - "27018:27017"
```

#### Production stack env file (`infra/env.prod`)

The production compose bundle in `infra/docker-compose.prod.yml` still uses an env file named `infra/env.prod`. Copy `infra/env.prod.example`
to `infra/env.prod` and update the values so they mirror whichever host the stack belongs to. For example, if the Ubuntu machine owns the
`shop_ubuntu` databases and exposes the API through `http://ubuntu-host.local:8085`, your `infra/env.prod` should look like:

```env
POSTGRES_USER=ecom
POSTGRES_PASSWORD=ecom
POSTGRES_DB=shop_ubuntu
DATABASE_URL=postgresql://ecom:ecom@postgres:5432/shop_ubuntu?schema=public

MONGO_URL=mongodb://mongo:27017/shop_ubuntu

APP_URL=http://ubuntu-host.local:8085
JWT_SECRET=replace-with-strong-secret
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

If you maintain a second stack (for example on Windows), keep a separate copy such as `infra/env.prod.win` with its own database names and
URLs (e.g., `shop_win`, `http://windows-host.local/api`). Point `docker compose --env-file infra/env.prod.win -f infra/docker-compose.prod.yml`
at the matching env file when you deploy that host. This keeps production secrets scoped correctly and avoids the two deployments seeding the
same Postgres or Mongo databases by accident.

Copy the appropriate env files into place on each host (or pass them via `--env-file`) before running `pnpm run setup` so every service points at its own database schemas and baked-in API URL.

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
