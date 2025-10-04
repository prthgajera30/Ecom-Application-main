#!/bin/sh
set -euo pipefail

normalize_bool() {
  case "${1:-}" in
    1|true|TRUE|True|yes|YES|Yes|on|ON|On)
      echo "true"
      ;;
    0|false|FALSE|False|no|NO|No|off|OFF|Off)
      echo "false"
      ;;
    *)
      echo ""
      ;;
  esac
}

should_setup_db=""
requested_setup="$(normalize_bool "${AUTO_DB_SETUP:-}")"
if [ -n "$requested_setup" ]; then
  should_setup_db="$requested_setup"
else
  node_env_lower="$(printf '%s' "${NODE_ENV:-}" | tr '[:upper:]' '[:lower:]')"
  if [ "$node_env_lower" = "production" ]; then
    should_setup_db="true"
  fi
fi

setup_marker=".db-setup-done"

if [ "$should_setup_db" = "true" ] && [ ! -f "$setup_marker" ]; then
  echo "[entrypoint] Running database migrations..."
  migrate_attempt=0
  while true; do
    if pnpm prisma:migrate; then
      break
    fi
    migrate_attempt=$((migrate_attempt + 1))
    if [ $migrate_attempt -ge 5 ]; then
      echo "[entrypoint] Prisma migrations failed after $migrate_attempt attempts; aborting." >&2
      exit 1
    fi
    echo "[entrypoint] Prisma migrations failed (attempt $migrate_attempt). Retrying in 5 seconds..."
    sleep 5
  done

  echo "[entrypoint] Seeding databases..."
  seed_attempt=0
  while true; do
    if pnpm prisma:seed; then
      break
    fi
    seed_attempt=$((seed_attempt + 1))
    if [ $seed_attempt -ge 5 ]; then
      echo "[entrypoint] Seeding failed after $seed_attempt attempts; aborting." >&2
      exit 1
    fi
    echo "[entrypoint] Seeding failed (attempt $seed_attempt). Retrying in 5 seconds..."
    sleep 5
  done

  touch "$setup_marker"
  echo "[entrypoint] Database ready."
else
  if [ "$should_setup_db" != "true" ]; then
    echo "[entrypoint] AUTO_DB_SETUP disabled; skipping migrations and seed."
  else
    echo "[entrypoint] Database already prepared; skipping migrations and seed."
  fi
fi

exec "$@"
