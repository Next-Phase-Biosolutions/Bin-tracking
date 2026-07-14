# Production image for the bin-tracker API. Built from the monorepo root
# (see infra/vps/bintracker-api/docker-compose.yml `build.context`) so pnpm
# workspace deps (`@bin-tracker/db`, `@bin-tracker/types`, `@bin-tracker/validators`)
# resolve correctly.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validators/package.json packages/validators/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @bin-tracker/db generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["pnpm", "start"]
