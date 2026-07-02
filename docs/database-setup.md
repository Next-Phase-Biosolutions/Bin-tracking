# Database Setup Guide — Local Postgres per Developer + Supabase Production

This project uses a  database workflow:

- **Each developer** runs their own isolated local PostgreSQL database (same schema, own data).
- **Production** runs on **Supabase** (managed PostgreSQL).
- **Schema changes** flow: developer laptop → Git PR → CI → production Supabase via versioned Prisma migrations.

Developers **never** connect to production. They only commit migration SQL files; production schema is updated by `migrate deploy` in CI/CD.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [New Developer Quick Start](#new-developer-quick-start)
4. [Prisma Commands Reference](#prisma-commands-reference)
5. [Authoring a Schema Change](#authoring-a-schema-change)
6. [Production Supabase Setup](#production-supabase-setup)
7. [CI Pipeline](#ci-pipeline)
8. [Production Deploy Checklist](#production-deploy-checklist)
9. [Environment Variables](#environment-variables)
10. [Rules and Safety](#rules-and-safety)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SINGLE SOURCE OF TRUTH                           │
│   packages/db/prisma/schema.prisma  +  prisma/migrations/*.sql  (Git)    │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│ Developer A      │      │ Developer B      │      │ Production           │
│ localhost:5432   │      │ localhost:5432   │      │ Supabase             │
│ bin_tracker      │      │ bin_tracker      │      │ (managed Postgres)   │
│ own .env         │      │ own .env         │      │ secrets in hosting   │
└──────────────────┘      └──────────────────┘      └──────────────────────┘
          │                           │                           │
          └──────── migrate dev ──────┴──── migrate deploy ───────┘
                    (creates SQL)              (applies SQL)
```

| Layer | Database | Who | Command |
| --- | --- | --- | --- |
| Local dev | Native Postgres `:5432` | Each developer | `pnpm db:migrate:dev` |
| CI / PR | Ephemeral Postgres (GitHub Actions) | CI bot | `pnpm db:migrate` |
| Production | Supabase | Ops / CI only | `pnpm db:migrate` |

**Monorepo paths:**

| What | Path |
| --- | --- |
| Prisma schema | `packages/db/prisma/schema.prisma` |
| Migrations | `packages/db/prisma/migrations/` |
| Prisma config | `packages/db/prisma.config.ts` |
| Local seed | `packages/db/prisma/seed.local.ts` |
| Production seed | `packages/db/prisma/seed.ts` |

---

## Prerequisites

Each developer needs:

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [PostgreSQL 16](https://www.postgresql.org/download/) installed locally
- Git access to the repository

Production setup (ops only):

- A [Supabase](https://supabase.com/) production project
- Hosting for API (Render) and frontend (Netlify) with secret management

---

## New Developer Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd bin-tracker
pnpm install
```

### 2. Create your personal `.env`

```bash
cp .env.example .env
```

Each developer keeps their own `.env` file — **never commit it**.

### 3. Install and start local Postgres

Install PostgreSQL 16 from [postgresql.org/download](https://www.postgresql.org/download/), then create the database:

**Mac (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb bin_tracker
```

**Windows:** [Download installer](https://www.postgresql.org/download/windows/), then:

```cmd
createdb -U postgres bin_tracker
```

Update `DATABASE_URL` and `DIRECT_URL` in `.env` if your username or password differs from the defaults in `.env.example`.

### 4. Apply schema and seed

```bash
pnpm db:generate    # regenerate Prisma Client
pnpm db:migrate     # apply all committed migrations (migrate deploy)
pnpm db:seed:local  # bootstrap data (no Supabase required)
```

### 5. Run the app

```bash
pnpm dev
```

### 6. Verify

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| API health | http://localhost:3001/health |
| Prisma Studio | `pnpm db:studio` |

Auth is bypassed locally (`DISABLE_AUTH=true`). The API auto-injects the admin user.

### After pulling new code

When teammates merge schema changes:

```bash
git pull
pnpm db:migrate
pnpm db:generate
```

---

## Prisma Commands Reference

Run all commands from the **repository root**.

| Command | Where | Purpose |
| --- | --- | --- |
| `pnpm db:generate` | Anywhere | Regenerate Prisma Client after schema changes |
| `pnpm db:migrate` | Local sync, CI, production | Apply pending migrations (`migrate deploy`) |
| `pnpm db:migrate:dev` | **Local only** | Create + apply a new migration while developing |
| `pnpm db:migrate:reset` | **Local only** | Wipe DB, reapply migrations, re-run `seed.local.ts` |
| `pnpm db:migrate:status` | Anywhere | Show which migrations have been applied |
| `pnpm db:seed:local` | Local, CI | Seed without Supabase (recommended for dev) |
| `pnpm db:seed` | Production bootstrap | Seed with Supabase Auth users (ops only) |
| `pnpm db:studio` | Local | GUI to browse your local database |

### Common workflows

**First day on the project:**

```bash
cp .env.example .env
pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed:local
pnpm dev
```

(Ensure PostgreSQL is running and `bin_tracker` database exists — see [New Developer Quick Start](#new-developer-quick-start).)

**Reset your local database (safe anytime on your machine):**

```bash
pnpm db:migrate:reset
```

**Inspect your data:**

```bash
pnpm db:studio
```

---

## Authoring a Schema Change

Only use `db:migrate:dev` on **your local** database.

```bash
# 1. Edit packages/db/prisma/schema.prisma

# 2. Create and apply migration locally
pnpm db:migrate:dev --name describe_your_change

# 3. Verify
pnpm test
pnpm dev

# 4. Commit migration files — production will run these SQL files
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): describe_your_change"
git push origin feat/your-branch
```

Open a PR to `dev`. CI will:

1. Spin up a fresh Postgres container
2. Run `pnpm db:migrate` (migrate deploy)
3. Run `pnpm db:seed:local` and tests

**Never** run `pnpm db:migrate:dev` or `pnpm db:migrate:reset` against Supabase production.

### Migration flow

```mermaid
flowchart LR
  A[Edit schema.prisma] --> B[db:migrate:dev locally]
  B --> C[Commit migration SQL]
  C --> D[Open PR to dev]
  D --> E[CI: migrate deploy + tests]
  E --> F[Review + merge]
  F --> G[Production: migrate deploy on Supabase]
  G --> H[Deploy app]
```

---

## Production Supabase Setup

### Connection strings

In Supabase **Project Settings → Database**:

| Setting | Port | Env var | Use for |
| --- | --- | --- | --- |
| Transaction pooler | `6543` | `DATABASE_URL` | App runtime queries |
| Direct connection | `5432` | `DIRECT_URL` | Migrations |

Example (store in Render secrets, not Git):

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres"
SEED_ONLY_IF_EMPTY="true"
NODE_ENV="production"
DISABLE_AUTH="false"
```

> **Prisma 7 note:** `directUrl` was removed from `schema.prisma` / `prisma.config.ts`.
> The CLI reads `DIRECT_URL` via `packages/db/prisma.config.ts` (`url` field).
> The running API still uses the pooled `DATABASE_URL` through the driver adapter in `client.ts`.

### First-time production migration

Run from CI/CD or a secure ops machine:

```bash
pnpm db:generate
pnpm db:migrate
```

Optional one-time bootstrap (safe — never wipes existing data):

```bash
SEED_ONLY_IF_EMPTY=true NODE_ENV=production pnpm db:seed
```

`seed.ts` is production-safe by default:

- Requires `SEED_ONLY_IF_EMPTY=true` when `NODE_ENV=production`
- Skips entirely if any users already exist
- Never deletes data unless `SEED_FORCE=true` (blocked in production)
- Dev full re-seed with Supabase: `SEED_FORCE=true pnpm db:seed` (local/staging only)

### Production deploy order

| Step | Action | Why |
| --- | --- | --- |
| 1 | `pnpm db:migrate` against Supabase | Apply new schema |
| 2 | Deploy API (Render) | New code expects new schema |
| 3 | Deploy frontend (Netlify) | If needed |

Do **not** run migrations inside the API container on every restart. Use a dedicated pre-deploy job.

See [deployment-guide.md](../deployment-guide.md) for hosting details.

---

## CI Pipeline

`.github/workflows/ci.yml` runs on every PR and push to `dev` / `main`:

1. **lint** — `pnpm lint`
2. **migrate-and-test** (depends on lint):
   - Postgres 16 service container
   - `pnpm db:generate`
   - `pnpm db:migrate` (migrate deploy)
   - `pnpm db:seed:local`
   - `pnpm typecheck` + `pnpm test`

## Production Deploy Workflow

`.github/workflows/deploy-production.yml` runs on push to `main` (or manual dispatch):

1. Uses the GitHub `production` environment (configure required reviewers in repo settings)
2. `pnpm db:migrate` against Supabase (`DIRECT_URL` via `prisma.config.ts`)
3. `pnpm db:seed` with `SEED_ONLY_IF_EMPTY=true` (bootstrap only — never wipes)
4. `pnpm db:migrate:status` for verification

**Required GitHub secrets** (in the `production` environment):

| Secret | Description |
| --- | --- |
| `DATABASE_URL` | Supabase pooler URL (app runtime) |
| `DIRECT_URL` | Supabase direct URL (migrations + seed CLI) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SUPABASE_ANON_KEY` | Anon key |

After migrations succeed, deploy the API on Render and frontend on Netlify as usual.

---

## Production Deploy Checklist

- [ ] PR merged; migration files in `packages/db/prisma/migrations/`
- [ ] CI passed (`pnpm lint`, migrate deploy + tests green)
- [ ] Supabase backup / PITR window confirmed
- [ ] `deploy-production` workflow succeeded (or manual `pnpm db:migrate`)
- [ ] Verify row in `_prisma_migrations` table
- [ ] Deploy API with matching code version
- [ ] Smoke-test critical API paths

---

## Environment Variables

| Variable | Local dev | CI | Production |
| --- | --- | --- | --- |
| `DATABASE_URL` | `localhost:5432` | CI Postgres | Supabase **pooler** `:6543` |
| `DIRECT_URL` | Same as local URL | CI Postgres | Supabase **direct** `:5432` |
| `SEED_ONLY_IF_EMPTY` | `true` (safe default) | `false` | `true` |
| `DISABLE_AUTH` | `true` | `true` | `false` |
| `NODE_ENV` | `development` | `test` | `production` |

---

## Rules and Safety

### Do

- Commit every migration folder to Git
- Use `db:migrate:dev` only on local databases
- Use `db:migrate` (`migrate deploy`) on CI and production
- Keep production credentials in hosting secret stores
- Use Supabase pooler for app runtime, direct URL for migrations

### Do not

- Give developers production Supabase credentials
- Run `db:migrate:dev` or `db:migrate:reset` against production
- Commit `.env` files with real secrets
- Auto-run migrations on every API container restart

### Who can access what

| Role | Local DB | Production Supabase |
| --- | --- | --- |
| Developer | Full (own machine) | **No access** |
| CI bot | Ephemeral test DB | **No access** |
| Ops / release | N/A | Migrate + deploy via CI/CD |

---

## Troubleshooting

### `P1001: Can't reach database server`

- Local: is PostgreSQL running? (`brew services list` on Mac, Services panel on Windows)
- Wrong port or password in `.env`
- Database `bin_tracker` not created — run `createdb bin_tracker`

### `prepared statement already exists` (Supabase pooler)

- Add `?pgbouncer=true` to `DATABASE_URL`
- Set `DIRECT_URL` for migrations
- Use transaction pooler (port `6543`)

### Stale local schema after `git pull`

```bash
pnpm db:migrate
pnpm db:generate
```

If drift is severe:

```bash
pnpm db:migrate:reset
```

### Migration works locally but fails in CI

- Run `pnpm db:migrate:reset` locally and retry
- Ensure all changes are captured in committed migration SQL (no manual DB edits)

---

## Related docs

- [README — Local Development Setup](../README.md#local-development-setup)
- [CONTRIBUTING — Database migrations](../CONTRIBUTING.md#database-migrations)
- [Deployment Guide](../deployment-guide.md)
