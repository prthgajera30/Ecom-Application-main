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

parse_url_component() {
  component="$1"
  url="$2"
  node -e '
const component = process.argv[1];
const rawUrl = process.argv[2];
try {
  const parsed = new URL(rawUrl);
  if (component === "host") {
    console.log(parsed.hostname);
  } else if (component === "port") {
    const protocol = parsed.protocol.replace(/:$/, "");
    const port = parsed.port || (protocol === "postgres" || protocol === "postgresql" ? "5432" : protocol === "mongodb" ? "27017" : "");
    if (port) {
      console.log(port);
    }
  }
} catch (error) {
  // ignore parsing errors and fall back to defaults
}
' "$component" "$url"
}

warn_if_localhost() {
  host="$1"
  config_name="$2"
  case "$host" in
    localhost|127.0.0.1|::1)
      echo "[entrypoint] WARNING: $config_name points to $host which is not reachable from inside the container. Update it to the service hostname (e.g. postgres or mongo)." >&2
      ;;
  esac
}

wait_for_tcp() {
  host="$1"
  port="$2"
  service_name="$3"
  max_attempts="${4:-40}"
  sleep_seconds="${5:-3}"

  if [ -z "$host" ] || [ -z "$port" ]; then
    return 0
  fi

  echo "[entrypoint] Waiting for $service_name at $host:$port..."
  attempt=1
  while [ $attempt -le $max_attempts ]; do
    if node - <<'NODE' "$host" "$port"; then
const args = process.argv.slice(2);
const host = args[0];
const port = Number(args[1]);
const net = require('net');
const socket = new net.Socket();
const timeout = setTimeout(() => {
  socket.destroy();
  process.exit(1);
}, 1000);
socket.connect(port, host, () => {
  clearTimeout(timeout);
  socket.end();
  process.exit(0);
});
socket.on('error', () => {
  clearTimeout(timeout);
  process.exit(1);
});
NODE
    then
      echo "[entrypoint] $service_name is available."
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "$sleep_seconds"
  done

  echo "[entrypoint] $service_name is unavailable after $max_attempts attempts." >&2
  return 1
}

if [ "$should_setup_db" = "true" ] && [ ! -f "$setup_marker" ]; then
  pg_host="$(parse_url_component host "${DATABASE_URL:-}")"
  pg_port="$(parse_url_component port "${DATABASE_URL:-}")"
  if [ -n "$pg_host" ]; then
    warn_if_localhost "$pg_host" "DATABASE_URL"
  fi
  if ! wait_for_tcp "$pg_host" "$pg_port" "PostgreSQL"; then
    echo "[entrypoint] Unable to reach PostgreSQL using DATABASE_URL=$pg_host:$pg_port" >&2
    exit 1
  fi

  mongo_host="$(parse_url_component host "${MONGO_URL:-}")"
  mongo_port="$(parse_url_component port "${MONGO_URL:-}")"
  if [ -n "$mongo_host" ]; then
    warn_if_localhost "$mongo_host" "MONGO_URL"
  fi
  if [ -n "$mongo_host" ] && ! wait_for_tcp "$mongo_host" "$mongo_port" "MongoDB"; then
    echo "[entrypoint] Unable to reach MongoDB using MONGO_URL=$mongo_host:$mongo_port" >&2
    exit 1
  fi

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
