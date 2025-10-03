#!/usr/bin/env bash
set -euo pipefail

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
          echo "Prisma migrations failed after retrying. Verify your DATABASE_URL credentials and rerun the command."
          exit 1
        fi
      else
        echo "Postgres did not become healthy after resetting the volume. Check container logs and rerun the command."
        exit 1
      fi
    else
      if [ -n "$AUTO_RESET_BLOCK_REASON" ]; then
        echo "Automatic Docker reset was skipped because ${AUTO_RESET_BLOCK_REASON}."
      fi
      echo "Prisma migrations failed with P1000. Ensure your DATABASE_URL credentials match the running Postgres instance."
      echo "You can set AUTO_RESET_DB_ON_P1000=1 to allow the script to reset the Docker volume automatically."
      exit 1
    fi
  else
    echo "Prisma migrations failed. Ensure your DATABASE_URL credentials match the running Postgres instance. If you changed credentials recently, run 'docker compose down --volumes' to reset the database volume before retrying."
    exit 1
  fi
fi

if [ ! -f .first-run-done ]; then
  pnpm --filter @apps/api prisma:seed
  touch .first-run-done
  echo "Database seeded (created .first-run-done marker)."
else
  echo "Seed skipped; .first-run-done already exists."
fi
