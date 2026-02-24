# Project Structure & Architecture Diagrams

## Monorepo Structure (Visual)

```
bin-tracker/
│
├── 📱 apps/                         # Applications
│   ├── web/                         # Next.js (All UIs)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (tablet)/       # Tablet interface routes
│   │   │   │   ├── (dashboard)/    # Dashboard routes
│   │   │   │   └── (driver)/       # Driver app routes
│   │   │   ├── components/
│   │   │   │   ├── tablet/         # Tablet-specific components
│   │   │   │   ├── dashboard/      # Dashboard components
│   │   │   │   └── shared/         # Shared components
│   │   │   └── trpc/               # tRPC client
│   │   └── package.json
│   │
│   ├── api/                         # Fastify Backend
│   │   ├── src/
│   │   │   ├── trpc/
│   │   │   │   ├── routers/
│   │   │   │   │   ├── bin.router.ts
│   │   │   │   │   ├── cycle.router.ts
│   │   │   │   │   ├── facility.router.ts
│   │   │   │   │   └── auth.router.ts
│   │   │   │   ├── context.ts      # tRPC context
│   │   │   │   └── trpc.ts         # tRPC setup
│   │   │   ├── services/           # Business logic
│   │   │   ├── middleware/         # Auth, logging
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── docs/                        # Documentation (optional)
│
├── 📦 packages/                     # Shared packages
│   ├── types/                       # TypeScript types
│   │   ├── src/
│   │   │   ├── bin.ts
│   │   │   ├── cycle.ts
│   │   │   ├── event.ts
│   │   │   ├── facility.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── db/                          # Database (Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   └── client.ts
│   │   └── package.json
│   │
│   ├── ui/                          # Shared UI components
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── QRScanner.tsx
│   │   │   ├── CountdownTimer.tsx
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── validators/                  # Zod schemas
│   │   ├── src/
│   │   │   ├── bin.schema.ts
│   │   │   ├── cycle.schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── config/                      # Shared configs
│       ├── eslint/
│       ├── typescript/
│       └── prettier/
│
├── 🔧 tools/                        # Standalone tools
│   └── cardano-anchor/              # Cardano anchoring service
│       ├── src/
│       │   ├── merkle.ts
│       │   ├── nft-minter.ts
│       │   └── scheduler.ts
│       └── package.json
│
├── 🚀 .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── 📝 Configuration files
│   ├── turbo.json                   # Turborepo config
│   ├── package.json                 # Root package.json
│   ├── tsconfig.json                # Root TypeScript config
│   ├── .eslintrc.js                 # ESLint config
│   ├── .prettierrc                  # Prettier config
│   ├── docker-compose.yml           # Local development
│   └── .env.example                 # Environment variables template
│
└── 📚 Documentation
    ├── README.md
    ├── CONTRIBUTING.md
    └── docs/
```

---

## System Architecture (Production)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Tablet     │  │  Dashboard   │  │  Driver App  │             │
│  │   (PWA)      │  │  (Web)       │  │  (PWA)       │             │
│  │              │  │              │  │              │             │
│  │  Next.js 14  │  │  Next.js 14  │  │  Next.js 14  │             │
│  │  + tRPC      │  │  + tRPC      │  │  + tRPC      │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                      │
│         └─────────────────┼─────────────────┘                      │
│                           │                                        │
└───────────────────────────┼────────────────────────────────────────┘
                            │
                            │ HTTPS (tRPC over HTTP)
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│                        EDGE LAYER (Vercel)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Next.js Edge Functions                                       │ │
│  │  - Static pages (cached globally)                             │ │
│  │  - Server components (rendered on edge)                       │ │
│  │  - API routes (tRPC endpoints)                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ Internal API calls
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│                     APPLICATION LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Fastify Backend (Node.js + TypeScript)                       │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ │
│  │  │ tRPC Routers │  │  Services    │  │  Middleware  │        │ │
│  │  │              │  │              │  │              │        │ │
│  │  │ - bin        │  │ - binService │  │ - auth       │        │ │
│  │  │ - cycle      │  │ - cycleServ. │  │ - logging    │        │ │
│  │  │ - facility   │  │ - facilityS. │  │ - rateLimit  │        │ │
│  │  │ - auth       │  │ - authServ.  │  │ - validation │        │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │ │
│  │                                                                │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            │ Prisma Client
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│                       DATA LAYER (Supabase)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL 16                                                 │ │
│  │                                                                │ │
│  │  Tables:                                                       │ │
│  │  - facilities                                                  │ │
│  │  - bin_types                                                   │ │
│  │  - bins                                                        │ │
│  │  - bin_cycles                                                  │ │
│  │  - event_logs (append-only)                                   │ │
│  │  - users                                                       │ │
│  │                                                                │ │
│  │  Features:                                                     │ │
│  │  - Row-Level Security (RLS)                                   │ │
│  │  - Real-time subscriptions                                    │ │
│  │  - Automatic backups                                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Supabase Auth                                                 │ │
│  │  - JWT tokens                                                  │ │
│  │  - Email/password                                              │ │
│  │  - Magic links                                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Supabase Realtime                                             │ │
│  │  - PostgreSQL change subscriptions                            │ │
│  │  - WebSocket connections                                       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER (Cardano)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Cardano Anchoring Service (Standalone)                        │ │
│  │                                                                │ │
│  │  Daily Job (Cron):                                             │ │
│  │  1. Fetch completed cycles from DB                            │ │
│  │  2. Build Merkle tree                                         │ │
│  │  3. Mint NFT with metadata + Merkle root                      │ │
│  │  4. Update DB with transaction hash                           │ │
│  │                                                                │ │
│  │  Stack: Lucid + Blockfrost                                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Cardano Blockchain                                            │ │
│  │  - Daily NFT with cycle metadata                              │ │
│  │  - Merkle root for verification                               │ │
│  │  - Immutable audit trail                                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    MONITORING & OBSERVABILITY                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Sentry     │  │   Grafana    │  │  Uptime      │             │
│  │   (Errors)   │  │   (Metrics)  │  │  Robot       │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow (Bin Lifecycle)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BIN LIFECYCLE DATA FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: BIN STARTED (Facility Tablet)
─────────────────────────────────────

  Tablet (PWA)
      │
      │ 1. Scan QR code
      │ 2. Call trpc.bin.start.mutate()
      ▼
  Next.js Edge
      │
      │ 3. Forward to tRPC router
      ▼
  Fastify Backend
      │
      │ 4. Validate input (Zod)
      │ 5. Check bin status
      │ 6. Calculate deadline (now + DK hours)
      ▼
  Prisma Client
      │
      │ 7. BEGIN TRANSACTION
      │ 8. INSERT INTO bin_cycles
      │ 9. INSERT INTO event_logs (BIN_STARTED)
      │ 10. UPDATE bins SET status = 'ACTIVE'
      │ 11. COMMIT
      ▼
  PostgreSQL
      │
      │ 12. Store data
      │ 13. Trigger Realtime notification
      ▼
  Supabase Realtime
      │
      │ 14. Push update to subscribed clients
      ▼
  Dashboard (Web)
      │
      │ 15. Receive real-time update
      │ 16. Refetch active bins
      │ 17. Update countdown timer
      ▼
  User sees bin appear in dashboard


STEP 2: PICKED UP (Driver App)
───────────────────────────────

  Driver App (PWA)
      │
      │ 1. Scan QR code
      │ 2. Call trpc.bin.pickup.mutate()
      ▼
  [Same flow as above]
      │
      │ 3. UPDATE bin_cycles SET status = 'IN_TRANSIT'
      │ 4. INSERT INTO event_logs (PICKED_UP)
      │ 5. UPDATE bins SET status = 'IN_TRANSIT'
      ▼
  Dashboard updates in real-time


STEP 3: DELIVERED (Driver App)
───────────────────────────────

  Driver App (PWA)
      │
      │ 1. Scan QR code
      │ 2. Call trpc.bin.deliver.mutate()
      ▼
  [Same flow as above]
      │
      │ 3. UPDATE bin_cycles SET status = 'COMPLETED'
      │ 4. Calculate compliance (on_time vs late)
      │ 5. INSERT INTO event_logs (DELIVERED)
      │ 6. UPDATE bins SET status = 'IDLE', current_cycle_id = NULL
      ▼
  Cycle complete, bin ready for reuse


DAILY: CARDANO ANCHORING (Automated)
─────────────────────────────────────

  Cron Job (00:00 UTC)
      │
      │ 1. Fetch completed cycles (yesterday)
      ▼
  Cardano Anchoring Service
      │
      │ 2. Build Merkle tree from cycle data
      │ 3. Calculate Merkle root
      │ 4. Create NFT metadata (CIP-25)
      ▼
  Lucid + Blockfrost
      │
      │ 5. Build transaction
      │ 6. Sign with wallet
      │ 7. Submit to Cardano
      ▼
  Cardano Blockchain
      │
      │ 8. Confirm transaction
      │ 9. Return tx hash
      ▼
  Update Database
      │
      │ 10. UPDATE bin_cycles SET anchored = true, anchor_tx_hash = '...'
      ▼
  Cycles now verifiable on blockchain
```

---

## Type Safety Flow (TypeScript)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    END-TO-END TYPE SAFETY                           │
└─────────────────────────────────────────────────────────────────────┘

DATABASE SCHEMA (Prisma)
────────────────────────
  prisma/schema.prisma
      │
      │ prisma generate
      ▼
  @prisma/client
      │
      │ Auto-generated TypeScript types
      │
      ├─→ Bin
      ├─→ BinCycle
      ├─→ EventLog
      └─→ Facility


VALIDATION SCHEMAS (Zod)
────────────────────────
  packages/validators/src/bin.schema.ts
      │
      │ export const binStartSchema = z.object({ ... })
      │
      ├─→ Runtime validation
      └─→ Type inference: z.infer<typeof binStartSchema>


API LAYER (tRPC)
────────────────
  apps/api/src/trpc/routers/bin.router.ts
      │
      │ export const binRouter = router({
      │   start: publicProcedure
      │     .input(binStartSchema)  ← Zod validation
      │     .mutation(async ({ input }) => {
      │       // input is fully typed!
      │       return await prisma.binCycle.create({ ... })
      │     })
      │ })
      │
      ▼
  Exported as AppRouter type


FRONTEND (React)
────────────────
  apps/web/src/components/BinScanner.tsx
      │
      │ import { trpc } from '@/trpc/client'
      │
      │ const startBin = trpc.bin.start.useMutation()
      │                    ▲         ▲
      │                    │         │
      │                    │         └─ Knows exact input/output types
      │                    │
      │                    └─ Autocomplete for all routers
      │
      │ startBin.mutate({
      │   binId: 'BIN-001',      ← TypeScript validates this!
      │   facilityId: 'chicago'  ← Autocomplete works!
      │ })
      │
      ▼
  Fully type-safe from DB → API → UI


COMPILE-TIME GUARANTEES
───────────────────────
  ✅ If you rename a field in Prisma schema:
     - TypeScript errors in API layer
     - TypeScript errors in frontend
     - Cannot deploy until fixed

  ✅ If you change API input shape:
     - TypeScript errors in frontend
     - Cannot call API with wrong data

  ✅ If you add a required field:
     - TypeScript forces you to provide it
     - Everywhere in the codebase

  ✅ Zero runtime errors from type mismatches
```

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT PIPELINE                            │
└─────────────────────────────────────────────────────────────────────┘

DEVELOPMENT
───────────
  Developer writes code
      │
      │ git commit
      ▼
  Husky pre-commit hook
      │
      ├─→ ESLint (code quality)
      ├─→ Prettier (formatting)
      ├─→ TypeScript check (type safety)
      └─→ Unit tests (fast tests)
      │
      │ All pass? ✅
      ▼
  Commit created


PULL REQUEST
────────────
  Developer pushes to GitHub
      │
      │ git push origin feature/bin-scanner
      ▼
  GitHub Actions CI
      │
      ├─→ Type check (tsc --noEmit)
      ├─→ Lint (ESLint)
      ├─→ Format check (Prettier)
      ├─→ Unit tests (Vitest)
      ├─→ Integration tests (Supertest)
      ├─→ E2E tests (Playwright)
      └─→ Build (Turborepo)
      │
      │ All pass? ✅
      ▼
  Vercel Preview Deployment
      │
      │ Automatic preview URL
      │ https://bin-tracker-pr-123.vercel.app
      ▼
  Code review + testing


MERGE TO MAIN
─────────────
  PR approved & merged
      │
      ▼
  GitHub Actions Deploy
      │
      ├─→ Run all CI checks again
      ├─→ Build production bundle
      ├─→ Run database migrations (Prisma)
      └─→ Deploy to Vercel (automatic)
      │
      ▼
  Production deployment
      │
      │ https://bin-tracker.yourcompany.com
      │
      ├─→ Frontend: Vercel Edge Network
      ├─→ Backend: Vercel Serverless Functions
      └─→ Database: Supabase (already running)
      │
      ▼
  Sentry monitoring active
  Grafana metrics collecting
  System live! 🚀
```

---

## Scalability Evolution

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SCALABILITY MILESTONES                           │
└─────────────────────────────────────────────────────────────────────┘

PHASE 1: MVP (Current)
──────────────────────
  5 facilities, ~50 bins
  
  ┌─────────────┐
  │   Vercel    │ ← Frontend
  └─────────────┘
  ┌─────────────┐
  │  Supabase   │ ← Backend + DB
  └─────────────┘
  
  Cost: $25/month
  Handles: 1,000 req/day


PHASE 2: GROWTH (+6 months)
───────────────────────────
  20 facilities, ~500 bins
  
  ┌─────────────┐
  │   Vercel    │ ← Frontend
  └─────────────┘
  ┌─────────────┐
  │  Supabase   │ ← Backend + DB
  └─────────────┘
  ┌─────────────┐
  │   Upstash   │ ← Redis cache (NEW)
  │   Redis     │   - Cache active bins (30s TTL)
  └─────────────┘   - Reduce DB load
  
  Cost: $75/month
  Handles: 10,000 req/day


PHASE 3: SCALE (+12 months)
───────────────────────────
  50 facilities, ~2,000 bins
  
  ┌─────────────┐
  │   Vercel    │ ← Frontend
  └─────────────┘
  ┌─────────────┐
  │  Supabase   │ ← Backend + DB
  └─────────────┘
  ┌─────────────┐
  │   Upstash   │ ← Redis cache
  │   Redis     │
  └─────────────┘
  ┌─────────────┐
  │   BullMQ    │ ← Queue system (NEW)
  │   Queue     │   - Background jobs
  └─────────────┘   - Cardano anchoring
  ┌─────────────┐
  │     CDN     │ ← Cloudflare (NEW)
  │ (Cloudflare)│   - Static assets
  └─────────────┘   - DDoS protection
  
  Cost: $200/month
  Handles: 100,000 req/day


PHASE 4: ENTERPRISE (+24 months)
────────────────────────────────
  100+ facilities, 10,000+ bins
  
  ┌─────────────────────────────────────┐
  │         Kubernetes Cluster          │
  │  ┌──────────┐  ┌──────────┐        │
  │  │Frontend  │  │ Backend  │        │
  │  │Service   │  │ Service  │        │
  │  └──────────┘  └──────────┘        │
  │  ┌──────────┐  ┌──────────┐        │
  │  │ Cardano  │  │  Queue   │        │
  │  │ Service  │  │ Workers  │        │
  │  └──────────┘  └──────────┘        │
  └─────────────────────────────────────┘
  ┌─────────────┐
  │ PostgreSQL  │ ← Managed DB (AWS RDS)
  │   Cluster   │   - Read replicas
  └─────────────┘   - Auto-scaling
  ┌─────────────┐
  │   Redis     │ ← Redis Cluster
  │  Cluster    │   - High availability
  └─────────────┘
  ┌─────────────┐
  │   Cardano   │ ← Own Cardano node
  │    Node     │   - No API limits
  └─────────────┘
  
  Cost: $1,000+/month
  Handles: 1M+ req/day
```

This architecture is designed to grow with your business without major rewrites! 🚀
