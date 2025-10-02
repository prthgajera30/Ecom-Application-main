#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/bootstrap.sh [--prod] [--dev] [--no-seed] [--no-build]

Options:
  --prod      Use infra/docker-compose.prod.yml (default is dev stack).
  --dev       Explicitly use infra/docker-compose.yml.
  --no-seed   Skip database seeding after migrations.
  --no-build  Skip "docker compose build" (containers rebuild only if needed by up).
  -h, --help  Show this help message.
USAGE
}

MODE="dev"
SEED="yes"
BUILD="yes"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod)
      MODE="prod"
      shift
      ;;
    --dev)
      MODE="dev"
      shift
      ;;
    --no-seed)
      SEED="no"
      shift
      ;;
    --no-build)
      BUILD="no"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"
ENV_NOTE=""

if [[ "$MODE" == "prod" ]]; then
  COMPOSE_FILE="$ROOT/infra/docker-compose.prod.yml"
  ENV_FILE="$ROOT/infra/env.prod"
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ROOT/infra/env.prod.example" ]]; then
      cp "$ROOT/infra/env.prod.example" "$ENV_FILE"
      ENV_NOTE="Copied infra/env.prod.example to infra/env.prod. Please review secrets before re-running."
    else
      echo "Missing infra/env.prod. Create it before continuing." >&2
      exit 1
    fi
  fi
fi

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "[bootstrap] Using compose file: $COMPOSE_FILE"
if [[ -n "$ENV_NOTE" ]]; then
  echo "[bootstrap] $ENV_NOTE"
  echo "[bootstrap] Edit infra/env.prod with real secrets, then re-run this script."
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon does not appear to be running." >&2
  exit 1
fi

if [[ "$BUILD" == "yes" ]]; then
  echo "[bootstrap] Building images..."
  compose build --pull
fi

echo "[bootstrap] Starting containers..."
compose up -d --build

echo "[bootstrap] Waiting for Postgres to become ready..."
compose exec -T postgres sh -c 'until pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; do sleep 1; done'

echo "[bootstrap] Running database migrations..."
if [[ "$MODE" == "prod" ]]; then
  compose exec -T api sh -c 'node_modules/.bin/prisma migrate deploy'
else
  compose exec -T api sh -c 'pnpm prisma migrate deploy'
fi

after_migrate() {
  if [[ "$SEED" == "no" ]]; then
    echo "[bootstrap] Skipping seed step (--no-seed supplied)."
    return
  fi

  echo "[bootstrap] Seeding catalog and demo users..."
  if [[ "$MODE" == "prod" ]]; then
    compose exec -T api sh -c 'node dist/scripts/seed.js'
  else
    compose exec -T api sh -c 'pnpm seed'
  fi
}

after_migrate

echo "[bootstrap] Stack is running."
if [[ "$MODE" == "prod" ]]; then
  echo "[bootstrap] Reverse proxy: http://localhost:8085"
else
  echo "[bootstrap] Web UI: http://localhost (nginx on :80)"
fi

echo "[bootstrap] Tail logs with: docker compose -f $COMPOSE_FILE logs -f"

