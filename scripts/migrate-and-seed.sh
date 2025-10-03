#!/usr/bin/env bash
set -euo pipefail

pnpm --filter @apps/api prisma:migrate

if [ ! -f .first-run-done ]; then
  pnpm --filter @apps/api prisma:seed
  touch .first-run-done
  echo "Database seeded (created .first-run-done marker)."
else
  echo "Seed skipped; .first-run-done already exists."
fi
