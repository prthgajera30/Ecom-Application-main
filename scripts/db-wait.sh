#!/usr/bin/env bash
set -euo pipefail

host="${DB_HOST:-localhost}"
port="${DB_PORT:-5432}"
user="${DB_USER:-ecom}"
database="${DB_NAME:-ecom}"

printf 'Waiting for Postgres at %s:%s...' "$host" "$port"
for _ in {1..60}; do
  if docker compose exec -T db pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
    printf '\nPostgres is ready.\n'
    exit 0
  fi
  printf '.'
  sleep 2
done

printf '\nPostgres did not become ready in time.\n'
exit 1
