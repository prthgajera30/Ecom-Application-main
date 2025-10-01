# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Dev image
FROM base AS dev
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY apps/api/package.json apps/api/tsconfig.json apps/api/jest.config.js ./
RUN pnpm install --prefer-frozen-lockfile || true
COPY apps/api ./
EXPOSE 4000
CMD ["pnpm","dev"]

# Prod build
FROM base AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY apps/api/package.json apps/api/tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY apps/api ./
RUN pnpm prisma generate
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
EXPOSE 4000
CMD ["node","dist/index.js"]
