# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS dev
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/tsconfig.json apps/web/next.config.js ./
RUN pnpm install --no-frozen-lockfile --prefer-offline
COPY apps/web ./
EXPOSE 3000
CMD ["pnpm","dev"]

FROM base AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/tsconfig.json apps/web/next.config.js ./

# Try frozen lockfile first, fallback to updating if needed
RUN pnpm install --frozen-lockfile --prefer-offline || (echo "Lockfile outdated, updating..." && pnpm install --prefer-offline)

COPY apps/web ./
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build /usr/src/app/.next ./.next
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./package.json
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-p","3000"]
