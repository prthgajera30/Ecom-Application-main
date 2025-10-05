#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '\n==> %s\n' "$1"
}

run_cmd() {
  local cmd=("$@")
  printf -- "--> Running: %s\n" "${cmd[*]}"
  "${cmd[@]}"
  return $?
}

run_cmd_allow_failure() {
  local cmd=("$@")
  printf -- "--> Running: %s\n" "${cmd[*]}"
  "${cmd[@]}"
  return $?
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
# install without running postinstall scripts to avoid prisma generate race on Windows; we'll run generate explicitly later
run_cmd pnpm install --recursive --ignore-scripts

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

if command -v docker >/dev/null 2>&1 && [ ! -f .first-run-done ]; then
  log "Resetting Docker database volumes for a clean first run"
  printf -- "--> Running: docker compose down --volumes --remove-orphans\n"
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
fi

log "Starting PostgreSQL and MongoDB containers"
should_wait=1
if command -v docker >/dev/null 2>&1; then
  if run_cmd docker compose up -d db mongo; then
    log "Waiting for PostgreSQL to become ready"
    if ! node scripts/run-script.mjs db-wait; then
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
# Cleanup stale prisma tmp files and move existing DLL out of the way to avoid EPERM on Windows
if [ -d node_modules/.prisma/client ]; then
  rm -f node_modules/.prisma/client/query_engine-windows.dll.node.tmp* || true
  if [ -f node_modules/.prisma/client/query_engine-windows.dll.node ]; then
    mv node_modules/.prisma/client/query_engine-windows.dll.node node_modules/.prisma/client/query_engine-windows.dll.node.bak || true
  fi
fi
if ! run_cmd_allow_failure pnpm -r --if-present prisma:generate; then
  echo "Command 'pnpm -r --if-present prisma:generate' exited with a non-zero status but setup will continue."
fi

log "Running migrations and seed (idempotent)"
set +e
node scripts/run-script.mjs migrate-and-seed
migrate_status=$?
set -e
if [ "$migrate_status" -ne 0 ]; then
  echo "migrate-and-seed script failed with exit code ${migrate_status}. Review the logs above for the pnpm commands that exited non-zero."
  exit "$migrate_status"
fi

if [ "${SKIP_SEED_IMAGE_FIX:-}" != "1" ]; then
  log "Validating and fixing seed images in MongoDB"
  # default runs and applies changes; use --dry for a preview
  if ! node scripts/fix-seed-images.js; then
    echo "Warning: seed image fixer encountered errors but setup will continue."
  fi
else
  echo "SKIP_SEED_IMAGE_FIX=1 detected; skipping seed image fixer step"
fi

log "Setup complete. Next steps: pnpm run dev"
