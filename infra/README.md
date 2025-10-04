# Production Docker Setup

This directory contains the production-oriented Docker Compose stack. To run it:

1. Copy the example environment file and fill in your secrets:
   ```bash
   cp infra/env.prod.example infra/env.prod
   ```
2. Edit `infra/env.prod` and replace the placeholder values with the credentials for your deployment (database password, JWT secret, Stripe keys, etc.). Ensure `POSTGRES_PASSWORD` matches the password embedded in `DATABASE_URL`, and that the connection strings use the container hostnames (e.g. `postgres` / `mongo`) rather than `localhost` so the services can talk to each other inside the network.
3. Launch the services in detached mode:
   ```bash
   docker compose -f infra/docker-compose.prod.yml up -d
   ```
   On first boot the API container automatically applies Prisma migrations and seeds the demo catalog so the storefront has data
   out of the box. Set `AUTO_DB_SETUP=0` in `infra/env.prod` if you prefer to manage migrations and seeds manually.
4. When you're done, shut the stack down with:
   ```bash
   docker compose -f infra/docker-compose.prod.yml down
   ```
