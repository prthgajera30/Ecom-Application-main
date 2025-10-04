# Production Docker Setup

This directory contains the production-oriented Docker Compose stack. To run it:

1. Copy the example environment file and fill in your secrets:
   ```bash
   cp infra/env.prod.example infra/env.prod
   ```
2. Edit `infra/env.prod` and replace the placeholder values with the credentials for your deployment (database password, JWT secret, Stripe keys, etc.). Ensure `POSTGRES_PASSWORD` matches the password embedded in `DATABASE_URL`.
3. Launch the services in detached mode:
   ```bash
   docker compose -f infra/docker-compose.prod.yml up -d
   ```
4. When you're done, shut the stack down with:
   ```bash
   docker compose -f infra/docker-compose.prod.yml down
   ```
