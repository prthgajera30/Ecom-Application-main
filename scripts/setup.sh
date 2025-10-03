#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '\n==> %s\n' "$1"
}

log "Ensuring Corepack is enabled"
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
else
  echo "Corepack is not available. Install Node.js 20 or newer (it ships with Corepack)."
  exit 1
fi

log "Checking toolchain versions"
node_version="$(node --version)"
echo "Node ${node_version}"
major="${node_version#v}"
major="${major%%.*}"
if [ "${major}" -lt 20 ]; then
  echo "Node.js 20 or newer is required. Current: ${node_version}"
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  corepack prepare pnpm@9.12.3 --activate
fi
echo "pnpm $(pnpm --version)"

log "Installing workspace dependencies"
pnpm install --recursive

log "Creating environment files if missing"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  - Created .env from .env.example"
fi
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "  - Created apps/api/.env from template"
fi
if [ ! -f apps/web/.env ]; then
  cp apps/web/.env.example apps/web/.env
  echo "  - Created apps/web/.env from template"
fi

log "Starting PostgreSQL and MongoDB containers"
should_wait=1
if command -v docker >/dev/null 2>&1; then
  if docker compose up -d db mongo; then
    log "Waiting for PostgreSQL to become ready"
    if ! ./scripts/db-wait.sh; then
      echo "Postgres did not become healthy. Inspect containers or start your local database manually."
      exit 1
    fi
  else
    echo "Docker Compose failed to start the containers. Ensure Docker Desktop is running or manage Postgres/Mongo manually."
    should_wait=0
  fi
else
  echo "Docker is not installed or not on PATH. Start Postgres and Mongo manually before continuing."
  should_wait=0
fi

if [ "$should_wait" -eq 0 ]; then
  log "Skipping Docker health checks; make sure your databases are running before migrations."
fi

log "Generating Prisma clients"
pnpm -r --if-present prisma:generate || true

log "Applying migrations"

run_migrations() {
  set +e
  output="$(pnpm --filter @apps/api prisma:migrate 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$output"
  return $status
}

should_auto_reset() {
  local flag="${AUTO_RESET_DB_ON_P1000:-1}"
  flag="$(printf '%s' "$flag" | tr '[:upper:]' '[:lower:]')"
  if [ "$flag" = "0" ] || [ "$flag" = "false" ]; then
    AUTO_RESET_BLOCK_REASON="AUTO_RESET_DB_ON_P1000 is disabled"
    return 1
  fi
  if [ -f .first-run-done ]; then
    AUTO_RESET_BLOCK_REASON="setup has already completed once"
    return 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    AUTO_RESET_BLOCK_REASON="docker is not available"
    return 1
  fi
  if ! docker compose ps --status running db >/dev/null 2>&1; then
    AUTO_RESET_BLOCK_REASON="docker compose db service is not running"
    return 1
  fi
  AUTO_RESET_BLOCK_REASON=""
  return 0
}

AUTO_RESET_BLOCK_REASON=""

if ! run_migrations; then
  if printf '%s' "$output" | grep -q 'P1000'; then
    if should_auto_reset; then
      echo "Prisma reported an authentication failure (P1000). Resetting the Docker Postgres volume and retrying once..."
      docker compose down --volumes
      docker compose up -d db mongo
      if ./scripts/db-wait.sh; then
        if run_migrations; then
          echo "Migrations succeeded after resetting the Postgres volume."
        else
          echo "Prisma migrations failed after retrying. Verify your DATABASE_URL credentials and rerun setup."
          exit 1
        fi
      else
        echo "Postgres did not become healthy after resetting the volume. Check container logs and rerun setup."
        exit 1
      fi
    else
      if [ -n "$AUTO_RESET_BLOCK_REASON" ]; then
        echo "Automatic Docker reset was skipped because ${AUTO_RESET_BLOCK_REASON}."
      fi
      echo "Prisma migrations failed with P1000. Ensure your DATABASE_URL credentials match the running Postgres instance."
      echo "You can set AUTO_RESET_DB_ON_P1000=1 to allow the setup script to reset the Docker volume automatically."
      exit 1
    fi
  else
    echo "Prisma migrations failed. Ensure your DATABASE_URL credentials match the running Postgres instance. If you changed credentials recently, run 'docker compose down --volumes' to reset the database volume before retrying."
    exit 1
  fi
fi

if [ ! -f .first-run-done ]; then
  log "First run detected – seeding database"
  pnpm --filter @apps/api prisma:seed
  touch .first-run-done
else
  log "Seed already applied (remove .first-run-done to rerun)"
fi

log "Setup complete. Next steps: pnpm run dev"
