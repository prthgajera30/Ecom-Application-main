# Runbook

- Start stack: `docker compose -f infra/docker-compose.yml up --build`
- Seed data: `docker compose -f infra/docker-compose.yml exec api node /usr/src/app/scripts/seed.js`
- Logs: check `nginx`, `api`, `web`, `recs` containers.
- Health checks: `/api/health`, `/recs/health`.
