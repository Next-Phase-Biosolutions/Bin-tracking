# 🫀 Bin Tracker

> A tamper-evident, blockchain-anchored organ transport tracking system built for precision, compliance, and auditability.

---

## Table of Contents

- [Introduction](#introduction)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
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
├── plans/                    # Architecture docs and specs
├── .env.example              # Environment variable template
└── turbo.json                # Turborepo pipeline config
```

---

## Local Development Setup

There are **two ways** to run this project locally depending on your setup.

| | Option A — Full Setup | Option B — Local Only |
|---|---|---|
| **Who** | Team members needing real auth | Juniors / contributors |
| **Supabase** | ✅ Required | ❌ Not needed |
| **Docker** | ❌ Not needed | ❌ Not needed |
| **Postgres** | Supabase-hosted | Local install |
| **Auth** | Full JWT auth | Bypassed (`DISABLE_AUTH=true`) |

---

## Option A — Full Setup (with Supabase)

### Prerequisites

- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0`
- A [Supabase](https://supabase.com/) project (free tier is fine)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/bin-tracker.git
cd bin-tracker
pnpm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in the required values in `.env` (see [Environment Variables](#environment-variables)).

### 3. Set Up the Database

```bash
# Run migrations
pnpm db:migrate

# Seed initial data (creates Supabase Auth users + DB records)
pnpm db:seed
```

### 4. Start the Development Servers

```bash
pnpm dev
```

### 5. Verify

- Frontend: [http://localhost:3000](http://localhost:3000)
- API health check: [http://localhost:3001/health](http://localhost:3001/health)
- Prisma Studio (DB browser): `pnpm db:studio`

---

## Option B — Local Only (No Supabase, No Docker)

> Ideal for juniors and contributors who just need to run the project locally.
> Auth is fully bypassed — no login required. The API auto-injects an admin user.

### 🍎 Mac

```bash
# 1. Install Node.js >= 20 (one time only)
brew install node@20

# 2. Install pnpm (one time only)
npm install -g pnpm

# 3. Install PostgreSQL (one time only)
brew install postgresql@16
brew services start postgresql@16

# 4. Create the local database (one time only)
createdb bin_tracker

# 5. Clone the repository
git clone https://github.com/your-org/bin-tracker.git
cd bin-tracker

# 6. Install dependencies
pnpm install

# 7. Copy the local env file (no Supabase credentials needed — works as-is)
cp .env.local.example .env

# 8. Run database migrations
pnpm db:migrate

# 9. Seed the database (no Supabase, cuid IDs, safe to re-run)
pnpm db:seed:local

# 10. Start both servers
pnpm dev
```

### 🪟 Windows

```cmd
:: 1. Install Node.js >= 20 (one time only)
::    Download from: https://nodejs.org/en/download
::    Choose the LTS version and run the installer.

:: 2. Install pnpm (one time only — open a NEW terminal after installing Node)
npm install -g pnpm

:: 3. Download and install PostgreSQL 16 from:
::    https://www.postgresql.org/download/windows/
::    During install, set password for the "postgres" user (remember it!)
::    Then start the PostgreSQL service from the Windows Services panel.

:: 4. Open Command Prompt and create the local database
createdb -U postgres bin_tracker
:: (enter your postgres password when prompted)

:: 5. Clone the repository
git clone https://github.com/your-org/bin-tracker.git
cd bin-tracker

:: 6. Install dependencies
pnpm install

:: 7. Copy the local env file
copy .env.local.example .env

::    If you set a password during Postgres install, update DATABASE_URL in .env:
::    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/bin_tracker"

:: 8. Run database migrations
pnpm db:migrate

:: 9. Seed the database
pnpm db:seed:local

:: 10. Start both servers
pnpm dev
```

### Verify (Both Platforms)

- Frontend: [http://localhost:3000](http://localhost:3000)
- API health check: [http://localhost:3001/health](http://localhost:3001/health)
- Prisma Studio (DB browser): `pnpm db:studio`

> **Note:** `SEED_ONLY_IF_EMPTY=true` is set by default in `.env.local.example`.
> If you accidentally run `pnpm db:seed:local` again, it will detect existing data and skip — your data is safe.

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
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database (requires Supabase) |
| `pnpm db:seed:local` | Seed for local dev — no Supabase needed (use with `.env.local.example`) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:generate` | Regenerate Prisma Client after schema changes |
| `pnpm clean` | Remove all build artifacts and `node_modules` |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase public anon key (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (API) |
| `SUPABASE_JWT_SECRET` | ✅ | Used to verify Supabase JWTs in the API |
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
