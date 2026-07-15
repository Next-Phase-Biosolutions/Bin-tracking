# Production image for the bin-tracker API. Built from the monorepo root
# (see infra/vps/bintracker-api/docker-compose.yml `build.context`) so pnpm
# workspace deps (`@bin-tracker/db`, `@bin-tracker/types`, `@bin-tracker/validators`)
# resolve correctly. The root .dockerignore keeps .git and every .env file
# (including infra/vps/*/.env on the VPS checkout) out of the build context —
# never remove those excludes.
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
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/api
USER node
EXPOSE 3001
# node:22-slim ships neither wget nor curl — use node's built-in fetch.
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Run tsx directly (not via pnpm) so SIGTERM reaches the node process — pnpm
# as PID 1 does not reliably forward signals, which breaks graceful shutdown
# during blue-green flips. The worker container overrides this with
# `command: ./node_modules/.bin/tsx src/worker.ts` in docker-compose.yml.
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
