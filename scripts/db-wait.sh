#!/usr/bin/env bash
set -euo pipefail

host="${DB_HOST:-localhost}"
port="${DB_PORT:-5432}"
user="${DB_USER:-ecom}"
database="${DB_NAME:-ecom}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

using_docker=false
if command_exists docker && docker compose ps --status running db >/dev/null 2>&1; then
  using_docker=true
fi

printf 'Waiting for Postgres at %s:%s...' "$host" "$port"
for _ in {1..60}; do
  if $using_docker; then
    if docker compose exec -T db pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
      printf '\nPostgres is ready.\n'
      exit 0
    fi
  else
    if command_exists pg_isready; then
      if PGPASSWORD="${DB_PASSWORD:-ecom}" pg_isready -h "$host" -p "$port" -U "$user" -d "$database" >/dev/null 2>&1; then
        printf '\nPostgres is ready.\n'
        exit 0
      fi
    else
      if node -e "const net=require('net');const socket=net.connect({host:process.argv[1],port:+process.argv[2]});socket.once('connect',()=>{socket.end();process.exit(0);});socket.once('error',()=>process.exit(1));setTimeout(()=>{socket.destroy();process.exit(1);},1000);" "$host" "$port" >/dev/null 2>&1; then
        printf '\nPostgres port is accepting TCP connections.\n'
        exit 0
      fi
    fi
  fi
  printf '.'
  sleep 2
done

printf '\nPostgres did not become ready in time.\n'
if $using_docker; then
  docker compose logs --tail 20 db || true
fi
exit 1
