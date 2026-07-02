# 🫀 Bin Tracker

> A tamper-evident, blockchain-anchored organ transport tracking system built for precision, compliance, and auditability.

---

## Table of Contents

- [Introduction](#introduction)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Database & Prisma Commands](#database--prisma-commands)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

---

## Introduction

Bin Tracker is a real-time organ transport monitoring platform designed for organ processing and rendering facilities. It tracks the full lifecycle of each organ bin from the moment it is started at a processing facility, through driver transit, to final delivery at a rendering facility enforcing strict Dead Kernel (DK) time compliance windows for each organ type.

Every state transition is recorded in an immutable, append-only event log. At the end of each operational day, all completed delivery cycles are cryptographically anchored to the **Cardano blockchain** via a Merkle tree root minted as a CIP-25 NFT giving regulators, hospitals, and auditors a trustless, verifiable record of operations.

The system serves three distinct user types:
- **Facility Tablets** — initiate bin cycles via QR scan.
- **Driver Mobile App** — manage pickups and deliveries in the field.
- **Ops Dashboard** — real-time KPIs, priority queues, overdue alerts, and blockchain anchoring controls.

---

## Key Features

### 🔍 Real-Time Lifecycle Tracking
Each bin follows a strict three-scan state machine: `IDLE → ACTIVE → IN_TRANSIT → COMPLETED`. All transitions are wrapped in Serializable database transactions to prevent race conditions.

### ⏱️ Organ-Specific DK Time Enforcement
Each organ type has a fixed Dead Kernel window (Heart: 4h, Liver: 6h, Kidneys: 12h, etc.). The system calculates a `deadline` at scan time and tracks compliance (`ON_TIME` / `LATE`) at delivery.

| Organ | DK Window | Urgency |
|---|---|---|
| Heart | 4 hours | 🔴 Critical |
| Liver | 6 hours | 🔴 Critical |
| Kidneys | 12 hours | 🟡 Medium |
| Skin | 24 hours | 🟢 Standard |
| Bones | 48 hours | 🟢 Low |
| Fat | 24 hours | 🟢 Standard |

### 🔗 Cardano Blockchain Anchoring
At the end of each day, all completed cycles are canonicalized, hashed, and assembled into a Merkle tree. The root is minted as a CIP-25 NFT on Cardano, producing a permanent, tamper-evident audit trail. Individual Merkle inclusion proofs can be generated per cycle for regulatory review.

### 🧾 Immutable Event Log
Every state transition appends an entry to the `EventLog` table (`BIN_STARTED`, `PICKED_UP`, `DELIVERED`). This log is write-only no event is ever updated or deleted.

### 📊 Ops Dashboard
- Live KPIs: active bins, overdue count, today's compliance rate.
- Priority queue sorted by urgency and remaining DK time.
- Per-facility and per-organ-type breakdowns.
- One-click blockchain anchoring with wallet integration.

### 🔐 Role-Based Access Control
Fine-grained procedure-level auth via Supabase JWTs:
- `ADMIN` — full system access.
- `OPS_MANAGER` — dashboard and reporting.
- `DRIVER` — pickup and delivery actions only.
- `WORKER` — facility-scoped read access.
- `Station` tokens — for facility-mounted tablets (no user login required).

### 🔄 Dynamic Bin Support
Supports Master QR Codes (e.g., `TYPE-HEART`) that dynamically create bin records on-the-fly, enabling operations before physical pre-labelled bins are available.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | [Turborepo](https://turbo.build/) + pnpm workspaces |
| API Server | [Fastify](https://fastify.dev/) + [tRPC](https://trpc.io/) |
| Frontend | [Vite](https://vitejs.dev/) + React + TypeScript |
| Database | PostgreSQL via [Prisma](https://www.prisma.io/) |
| Auth | [Supabase](https://supabase.com/) (JWT + Station tokens) |
| Blockchain | Cardano (CIP-25 NFT, Merkle tree SHA-256) |
| Deployment | Netlify (frontend) + Render (API) |

---

## Project Structure

```
bin-tracker/
├── apps/
│   ├── api/                  # Fastify + tRPC backend
│   │   └── src/
│   │       ├── routers/      # tRPC route definitions
│   │       ├── services/     # Business logic (bin, cycle, dashboard, blockchain)
│   │       ├── lib/          # Merkle tree, countdown, utilities
│   │       └── trpc/         # Context, middleware, procedure types
│   └── web/                  # Vite + React frontend
│       └── src/
│           ├── tablet/       # Facility tablet QR scan UI
│           ├── driver/       # Driver pickup/delivery UI
│           └── dashboard/    # Ops dashboard + blockchain anchoring modal
├── packages/
│   ├── db/                   # Prisma schema + migrations + seed
│   ├── types/                # Shared TypeScript types
│   └── validators/           # Shared Zod validators
├── docs/                     # Guides (database setup, specs)
├── plans/                    # Architecture docs and specs
├── .env.example              # Environment variable template (copy to .env)
└── turbo.json                # Turborepo pipeline config
```

---

## Local Development Setup

We use a **Masumi-style database workflow**: each developer runs their **own local PostgreSQL** database. Production lives on **Supabase** — developers never connect to it directly. Schema changes are committed as Prisma migration files and applied to production via CI/CD.

See the full guide: **[docs/database-setup.md](./docs/database-setup.md)**

### Prerequisites

- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0`
- **PostgreSQL 16** — install locally:
  - [Download PostgreSQL](https://www.postgresql.org/download/) (all platforms)
  - [macOS](https://www.postgresql.org/download/macosx/)
  - [Windows](https://www.postgresql.org/download/windows/)
  - [Linux](https://www.postgresql.org/download/linux/)

### One-time PostgreSQL setup

**Mac (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb bin_tracker
```

**Windows:** Install from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/), start the PostgreSQL service, then:

```cmd
createdb -U postgres bin_tracker
```

**Linux:** Use your distro packages or [postgresql.org/download/linux](https://www.postgresql.org/download/linux/), then:

```bash
createdb bin_tracker
```

### Quick Start

```bash
git clone https://github.com/your-org/bin-tracker.git
cd bin-tracker

cp .env.example .env
# Edit .env if your Postgres user/password differs from the defaults

pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed:local
pnpm dev
```

| Service | URL |
|---|---|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| API health | [http://localhost:3001/health](http://localhost:3001/health) |
| DB browser | `pnpm db:studio` |

Auth is bypassed locally (`DISABLE_AUTH=true`). The API auto-injects the admin user — no login required.

### After pulling new code

When teammates merge database changes:

```bash
git pull
pnpm db:migrate
pnpm db:generate
```

### Optional: Supabase Auth testing

To test real JWT login locally, fill in `SUPABASE_*` and `VITE_SUPABASE_*` in `.env` using a **personal dev** Supabase project. Keep `DATABASE_URL` and `DIRECT_URL` pointed at **local Postgres** — never use the production Supabase database URL.

Set `DISABLE_AUTH=false` only while testing login.

---

## Database & Prisma Commands

Run all commands from the **repository root**.

### Daily commands

| Command | When to use |
|---|---|
| `pnpm db:generate` | After pulling schema changes or editing `schema.prisma` |
| `pnpm db:migrate` | Apply committed migrations to your local DB (or CI/production) |
| `pnpm db:seed:local` | Bootstrap local test data (no Supabase) |
| `pnpm db:studio` | Browse your local database in a GUI |

### Schema changes (developers only)

When **you** are adding or changing tables:

```bash
# 1. Edit packages/db/prisma/schema.prisma
# 2. Create migration locally (never run this against production)
pnpm db:migrate:dev --name describe_your_change

# 3. Test, then commit the migration files
git add packages/db/prisma/
git commit -m "feat(db): describe_your_change"
```

Open a PR to `dev`. CI validates migrations on a fresh Postgres before merge.

### Reset your local database

Safe anytime on your own machine:

```bash
pnpm db:migrate:reset
```

### Production commands (ops / CI only)

| Command | Purpose |
|---|---|
| `pnpm db:migrate` | Apply pending migrations to Supabase (`migrate deploy`) |
| `pnpm db:seed` | One-time production bootstrap with Supabase Auth users |

Set `SEED_ONLY_IF_EMPTY=true` in production. Developers should **not** have production database credentials.

Production migrations run automatically via `.github/workflows/deploy-production.yml` on merge to `main`.

---

## Available Scripts

Run all scripts from the **root** of the repository.

| Script | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm lint:fix` | Lint and auto-fix all packages |
| `pnpm format` | Format all `ts`, `tsx`, `json`, `md` files with Prettier |
| `pnpm typecheck` | TypeScript type-check all packages |
| `pnpm db:generate` | Regenerate Prisma Client after schema changes |
| `pnpm db:migrate` | Apply committed migrations (`migrate deploy`) — local sync, CI, production |
| `pnpm db:migrate:dev` | **Local only** — create a new migration while developing |
| `pnpm db:migrate:reset` | **Local only** — wipe DB, reapply migrations, re-run `seed.local.ts` |
| `pnpm db:migrate:status` | Show which migrations have been applied |
| `pnpm db:seed` | Seed with Supabase Auth users (production bootstrap / ops only) |
| `pnpm db:seed:local` | Seed for local dev — no Supabase needed |
| `pnpm db:studio` | Open Prisma Studio (local DB browser) |
| `pnpm clean` | Remove all build artifacts and `node_modules` |

---

## Environment Variables

Copy `.env.example` to `.env` and adjust for your local Postgres credentials.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (local Postgres in dev; Supabase pooler in prod) |
| `DIRECT_URL` | ✅ | Direct Postgres URL (same as `DATABASE_URL` locally; Supabase direct in prod) |
| `SEED_ONLY_IF_EMPTY` | ⚠️ | `true` locally and in production — prevents accidental re-seed |
| `SUPABASE_URL` | ⚠️ | Optional locally (`DISABLE_AUTH=true`); required in production |
| `SUPABASE_ANON_KEY` | ⚠️ | Optional locally; required in production (frontend + API) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | Optional locally; required in production (API only) |
| `SUPABASE_JWT_SECRET` | ⚠️ | Optional locally; required in production (API) |
| `PORT` | ✅ | API server port (default: `3001`) |
| `HOST` | ✅ | API server host (default: `0.0.0.0`) |
| `CORS_ORIGIN` | ✅ | Allowed frontend origin (e.g., `http://localhost:3000`) |
| `DISABLE_AUTH` | ⚠️ | Set `true` to bypass auth — **dev/test only, never in production** |
| `BLOCKFROST_API_KEY` | ❌ | Cardano Blockfrost key (required for blockchain anchoring) |
| `CARDANO_NETWORK` | ❌ | `preprod` or `mainnet` |

---

## Contributing

We welcome contributions of all kinds. Please read our full **[Contributing Guide](./CONTRIBUTING.md)** before getting started — it covers branching strategy, code style, testing requirements, database migrations, the PR process, and security rules specific to this project.

---

> Built with care for the teams working to save lives through organ donation. ❤️
