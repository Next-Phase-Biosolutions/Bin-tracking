# Production-Ready Tech Stack — Bin Tracking System

**Version:** 2.0 (Production-Ready)  
**Date:** February 15, 2026  
**Status:** Approved for Implementation

---

## Executive Summary

This document defines the **production-ready, TypeScript-first** tech stack for the Bin Spoilage Tracking System. The architecture is designed to scale from **MVP (5 facilities, 50 bins)** to **enterprise (100+ facilities, 10,000+ bins)** with clear migration paths at each growth stage.

### Core Principles

1. **TypeScript Everywhere** — End-to-end type safety from database to UI
2. **Production-First** — Security, monitoring, and reliability built-in from day one
3. **Scalable by Design** — Clear migration path at each growth milestone
4. **Developer Experience** — Fast iteration with hot reload, type checking, and great tooling
5. **Cost-Effective** — Start at ~$25/month, scale predictably

---

## Final Production Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                  PRODUCTION STACK (TypeScript-First)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Monorepo:     Turborepo                                        │
│  Frontend:     Next.js 14 + React + TypeScript + tRPC Client   │
│  Backend:      Fastify + TypeScript + tRPC Server + Zod        │
│  Database:     Supabase (PostgreSQL + Real-time + Auth)        │
│  ORM:          Prisma (type-safe queries + migrations)         │
│  Validation:   Zod (runtime type validation)                   │
│  API:          tRPC (end-to-end type safety)                   │
│  Auth:         Supabase Auth (JWT + Row-Level Security)        │
│  Real-time:    Supabase Realtime (PostgreSQL subscriptions)    │
│  Cardano:      Lucid + Blockfrost                              │
│  Hosting:      Vercel (Frontend) + Supabase (Backend + DB)     │
│  QR Scan:      html5-qrcode                                    │
│  Maps:         Leaflet + OpenStreetMap                         │
│  Testing:      Vitest + Playwright + Supertest                 │
│  CI/CD:        GitHub Actions                                  │
│  Monitoring:   Sentry + Grafana Cloud                          │
│  Logging:      Pino (structured JSON logs)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

### Monorepo Structure (Turborepo)

```
bin-tracker/
├── apps/
│   ├── web/                    # Next.js (Dashboard + Tablet + Driver)
│   │   ├── src/
│   │   │   ├── app/           # Next.js 14 App Router
│   │   │   ├── components/    # React components
│   │   │   ├── lib/           # Utilities
│   │   │   └── trpc/          # tRPC client setup
│   │   ├── public/            # Static assets
│   │   └── package.json
│   │
│   ├── api/                    # Fastify Backend
│   │   ├── src/
│   │   │   ├── routes/        # API routes
│   │   │   ├── trpc/          # tRPC routers
│   │   │   ├── services/      # Business logic
│   │   │   ├── middleware/    # Auth, logging, etc.
│   │   │   └── server.ts      # Fastify server
│   │   └── package.json
│   │
│   └── docs/                   # Documentation site (optional)
│       └── package.json
│
├── packages/
│   ├── types/                  # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── bin.ts         # Bin types
│   │   │   ├── cycle.ts       # Cycle types
│   │   │   ├── event.ts       # Event types
│   │   │   └── index.ts       # Exports
│   │   └── package.json
│   │
│   ├── db/                     # Prisma + Database
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Database schema
│   │   │   └── migrations/    # Migration files
│   │   ├── src/
│   │   │   └── client.ts      # Prisma client
│   │   └── package.json
│   │
│   ├── ui/                     # Shared React components
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── QRScanner.tsx
│   │   │   └── CountdownTimer.tsx
│   │   └── package.json
│   │
│   ├── config/                 # Shared configs
│   │   ├── eslint/            # ESLint config
│   │   ├── typescript/        # TypeScript configs
│   │   └── prettier/          # Prettier config
│   │
│   └── validators/             # Zod schemas
│       ├── src/
│       │   ├── bin.schema.ts
│       │   ├── cycle.schema.ts
│       │   └── index.ts
│       └── package.json
│
├── tools/
│   └── cardano-anchor/         # Cardano anchoring service
│       ├── src/
│       │   ├── merkle.ts      # Merkle tree builder
│       │   ├── nft-minter.ts  # NFT minting
│       │   └── scheduler.ts   # Daily job
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml             # CI pipeline
│       └── deploy.yml         # Deployment
│
├── docker-compose.yml          # Local development
├── turbo.json                  # Turborepo config
├── package.json                # Root package.json
└── README.md
```

---

## TypeScript Configuration

### Root `tsconfig.json` (Strict Mode)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@bin-tracker/types": ["./packages/types/src"],
      "@bin-tracker/db": ["./packages/db/src"],
      "@bin-tracker/ui": ["./packages/ui/src"],
      "@bin-tracker/validators": ["./packages/validators/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next"]
}
```

### Type Safety Rules

```typescript
// ✅ ALLOWED
const binId: string = "BIN-001"
const count: number = 42
const bin: Bin = { id: "BIN-001", status: "active" }

// ❌ FORBIDDEN (will not compile)
const data: any = fetchData()  // NO 'any' types
const result = data.something  // Unsafe access

// ✅ CORRECT
const data: unknown = fetchData()
if (isBin(data)) {
  const result = data.id  // Type-safe
}
```

---

## Database Design (Prisma + Supabase)

### Prisma Schema (`packages/db/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Facilities
model Facility {
  id        String   @id @default(cuid())
  name      String
  address   String
  lat       Float
  lng       Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  bins      Bin[]
  cycles    BinCycle[]
  
  @@map("facilities")
}

// Bin Types (Organ Categories)
model BinType {
  id         String   @id @default(cuid())
  organType  String   @unique // "heart", "liver", "kidney", etc.
  dkHours    Int      // Spoilage time in hours
  prefix     String   // "BIN-HEART-"
  createdAt  DateTime @default(now())
  
  bins       Bin[]
  
  @@map("bin_types")
}

// Bins
model Bin {
  id                String    @id @default(cuid())
  qrCode            String    @unique
  binTypeId         String
  currentFacilityId String
  status            BinStatus @default(IDLE)
  currentCycleId    String?   @unique
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  binType           BinType      @relation(fields: [binTypeId], references: [id])
  currentFacility   Facility     @relation(fields: [currentFacilityId], references: [id])
  currentCycle      BinCycle?    @relation("CurrentCycle", fields: [currentCycleId], references: [id])
  cycles            BinCycle[]   @relation("BinCycles")
  
  @@index([status])
  @@index([currentFacilityId])
  @@map("bins")
}

enum BinStatus {
  IDLE
  ACTIVE
  IN_TRANSIT
  DELIVERED
}

// Bin Cycles (Lifecycle Tracking)
model BinCycle {
  id                String          @id @default(cuid())
  binId             String
  facilityId        String
  destinationId     String?
  status            CycleStatus     @default(ACTIVE)
  startedAt         DateTime        @default(now())
  deadline          DateTime
  pickedUpAt        DateTime?
  deliveredAt       DateTime?
  driverId          String?
  vehicleId         String?
  complianceStatus  ComplianceStatus?
  anchored          Boolean         @default(false)
  anchorTxHash      String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  bin               Bin             @relation("BinCycles", fields: [binId], references: [id])
  facility          Facility        @relation(fields: [facilityId], references: [id])
  currentBin        Bin?            @relation("CurrentCycle")
  events            EventLog[]
  
  @@index([status])
  @@index([deadline])
  @@index([facilityId])
  @@index([anchored])
  @@map("bin_cycles")
}

enum CycleStatus {
  ACTIVE
  IN_TRANSIT
  COMPLETED
  OVERDUE
}

enum ComplianceStatus {
  ON_TIME
  LATE
  OVERDUE
}

// Event Log (Append-Only)
model EventLog {
  id          String    @id @default(cuid())
  cycleId     String
  eventType   EventType
  timestamp   DateTime  @default(now())
  stationId   String?
  driverId    String?
  locationLat Float?
  locationLng Float?
  metadata    Json?
  
  cycle       BinCycle  @relation(fields: [cycleId], references: [id])
  
  @@index([cycleId])
  @@index([eventType])
  @@index([timestamp])
  @@map("event_logs")
}

enum EventType {
  BIN_STARTED
  PICKED_UP
  DELIVERED
}

// Users (for authentication)
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      UserRole @default(WORKER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("users")
}

enum UserRole {
  ADMIN
  OPS_MANAGER
  DRIVER
  WORKER
}
```

### Supabase Row-Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE bin_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

-- Workers can only start bins at their facility
CREATE POLICY "Workers can start bins at their facility"
ON bins FOR INSERT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'WORKER' AND
  current_facility_id IN (
    SELECT facility_id FROM user_facilities 
    WHERE user_id = auth.uid()
  )
);

-- Ops managers can see all bins
CREATE POLICY "Ops managers see all bins"
ON bins FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'role' IN ('OPS_MANAGER', 'ADMIN'));

-- Drivers can only see bins they're assigned to
CREATE POLICY "Drivers see assigned bins"
ON bin_cycles FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'DRIVER' AND
  driver_id = auth.uid()
);
```

---

## API Design (tRPC)

### tRPC Router Structure (`apps/api/src/trpc/routers/bin.router.ts`)

```typescript
import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { prisma } from '@bin-tracker/db'
import { binStartSchema, binPickupSchema } from '@bin-tracker/validators'

export const binRouter = router({
  // Start a bin cycle (Scan 1)
  start: protectedProcedure
    .input(binStartSchema)
    .mutation(async ({ input, ctx }) => {
      const { binId, facilityId } = input
      
      // Check if bin exists and is IDLE
      const bin = await prisma.bin.findUnique({
        where: { id: binId },
        include: { binType: true }
      })
      
      if (!bin) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bin not found'
        })
      }
      
      if (bin.status !== 'IDLE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Bin is already ${bin.status.toLowerCase()}`
        })
      }
      
      // Create new cycle
      const deadline = new Date()
      deadline.setHours(deadline.getHours() + bin.binType.dkHours)
      
      const cycle = await prisma.binCycle.create({
        data: {
          binId,
          facilityId,
          deadline,
          status: 'ACTIVE',
          events: {
            create: {
              eventType: 'BIN_STARTED',
              stationId: ctx.user.stationId,
              locationLat: ctx.location?.lat,
              locationLng: ctx.location?.lng
            }
          }
        },
        include: {
          bin: { include: { binType: true } },
          facility: true
        }
      })
      
      // Update bin status
      await prisma.bin.update({
        where: { id: binId },
        data: {
          status: 'ACTIVE',
          currentCycleId: cycle.id
        }
      })
      
      return {
        success: true,
        cycle,
        message: `Bin ${bin.qrCode} started. Deadline: ${deadline.toLocaleString()}`
      }
    }),
  
  // Get active bins (for dashboard)
  getActive: protectedProcedure
    .input(z.object({
      facilityId: z.string().optional(),
      sortBy: z.enum(['deadline', 'started']).default('deadline')
    }))
    .query(async ({ input }) => {
      const cycles = await prisma.binCycle.findMany({
        where: {
          status: { in: ['ACTIVE', 'IN_TRANSIT'] },
          ...(input.facilityId && { facilityId: input.facilityId })
        },
        include: {
          bin: { include: { binType: true } },
          facility: true
        },
        orderBy: {
          deadline: 'asc'
        }
      })
      
      // Calculate time remaining for each
      const now = new Date()
      return cycles.map(cycle => ({
        ...cycle,
        timeRemaining: cycle.deadline.getTime() - now.getTime(),
        isOverdue: now > cycle.deadline
      }))
    }),
  
  // Mark bin as picked up (Scan 2)
  pickup: protectedProcedure
    .input(binPickupSchema)
    .mutation(async ({ input, ctx }) => {
      const { cycleId, driverId, vehicleId } = input
      
      const cycle = await prisma.binCycle.update({
        where: { id: cycleId },
        data: {
          status: 'IN_TRANSIT',
          pickedUpAt: new Date(),
          driverId,
          vehicleId,
          events: {
            create: {
              eventType: 'PICKED_UP',
              driverId,
              locationLat: ctx.location?.lat,
              locationLng: ctx.location?.lng,
              metadata: { vehicleId }
            }
          }
        },
        include: {
          bin: true
        }
      })
      
      // Update bin status
      await prisma.bin.update({
        where: { id: cycle.binId },
        data: { status: 'IN_TRANSIT' }
      })
      
      return {
        success: true,
        cycle,
        message: 'Bin picked up successfully'
      }
    }),
  
  // Mark bin as delivered (Scan 3)
  deliver: protectedProcedure
    .input(z.object({ cycleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const now = new Date()
      
      const cycle = await prisma.binCycle.update({
        where: { id: input.cycleId },
        data: {
          status: 'COMPLETED',
          deliveredAt: now,
          complianceStatus: now <= cycle.deadline ? 'ON_TIME' : 'LATE',
          events: {
            create: {
              eventType: 'DELIVERED',
              driverId: ctx.user.id,
              locationLat: ctx.location?.lat,
              locationLng: ctx.location?.lng
            }
          }
        }
      })
      
      // Reset bin to IDLE
      await prisma.bin.update({
        where: { id: cycle.binId },
        data: {
          status: 'IDLE',
          currentCycleId: null
        }
      })
      
      return {
        success: true,
        cycle,
        message: 'Bin delivered successfully'
      }
    })
})
```

### Zod Validation Schemas (`packages/validators/src/bin.schema.ts`)

```typescript
import { z } from 'zod'

export const binStartSchema = z.object({
  binId: z.string().min(1, 'Bin ID is required'),
  facilityId: z.string().min(1, 'Facility ID is required')
})

export const binPickupSchema = z.object({
  cycleId: z.string().min(1, 'Cycle ID is required'),
  driverId: z.string().min(1, 'Driver ID is required'),
  vehicleId: z.string().optional()
})

export const binDeliverSchema = z.object({
  cycleId: z.string().min(1, 'Cycle ID is required')
})

export type BinStartInput = z.infer<typeof binStartSchema>
export type BinPickupInput = z.infer<typeof binPickupSchema>
export type BinDeliverInput = z.infer<typeof binDeliverSchema>
```

---

## Frontend Implementation (Next.js + tRPC)

### tRPC Client Setup (`apps/web/src/trpc/client.ts`)

```typescript
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../../../api/src/trpc/router'

export const trpc = createTRPCReact<AppRouter>()
```

### React Component Example (`apps/web/src/components/BinScanner.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { trpc } from '@/trpc/client'
import { useToast } from '@/hooks/use-toast'

export function BinScanner({ facilityId }: { facilityId: string }) {
  const [scannedBinId, setScannedBinId] = useState<string | null>(null)
  const { toast } = useToast()
  
  // tRPC mutation with full type safety
  const startBin = trpc.bin.start.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Success!',
        description: data.message
      })
      setScannedBinId(null)
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })
  
  const handleScan = (binId: string) => {
    setScannedBinId(binId)
  }
  
  const handleStart = () => {
    if (!scannedBinId) return
    
    // Fully typed! TypeScript knows exact input shape
    startBin.mutate({
      binId: scannedBinId,
      facilityId
    })
  }
  
  return (
    <div className="space-y-4">
      <QRScanner onScan={handleScan} />
      
      {scannedBinId && (
        <div className="p-4 border rounded">
          <p className="text-lg font-semibold">Scanned: {scannedBinId}</p>
          <button
            onClick={handleStart}
            disabled={startBin.isLoading}
            className="mt-2 px-6 py-3 bg-green-600 text-white rounded-lg"
          >
            {startBin.isLoading ? 'Starting...' : 'BIN STARTED'}
          </button>
        </div>
      )}
    </div>
  )
}
```

### Dashboard with Real-time Updates (`apps/web/src/app/dashboard/page.tsx`)

```typescript
'use client'

import { trpc } from '@/trpc/client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CountdownTimer } from '@bin-tracker/ui'

export default function DashboardPage() {
  // tRPC query with auto-refetch
  const { data: activeBins, refetch } = trpc.bin.getActive.useQuery({
    sortBy: 'deadline'
  })
  
  // Supabase real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('bin-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bin_cycles' },
        () => {
          refetch() // Refetch when database changes
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Active Bins</h1>
      
      <table className="w-full">
        <thead>
          <tr>
            <th>Countdown</th>
            <th>Bin ID</th>
            <th>Organ</th>
            <th>Facility</th>
            <th>Started</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {activeBins?.map((cycle) => (
            <tr key={cycle.id}>
              <td>
                <CountdownTimer 
                  deadline={cycle.deadline}
                  isOverdue={cycle.isOverdue}
                />
              </td>
              <td>{cycle.bin.qrCode}</td>
              <td>{cycle.bin.binType.organType}</td>
              <td>{cycle.facility.name}</td>
              <td>{new Date(cycle.startedAt).toLocaleTimeString()}</td>
              <td>{new Date(cycle.deadline).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## CI/CD Pipeline (GitHub Actions)

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run typecheck
  
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Format check
        run: npm run format:check
  
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
  
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
  
  build:
    runs-on: ubuntu-latest
    needs: [typecheck, lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
```

---

## Security Hardening

### Backend Security (`apps/api/src/server.ts`)

```typescript
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
})

// Security headers
await server.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
})

// CORS
await server.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
})

// Rate limiting
await server.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  })
})

// Input validation error handler
server.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    })
    return
  }
  
  // Log error (but don't expose internals)
  request.log.error(error)
  
  reply.status(error.statusCode || 500).send({
    statusCode: error.statusCode || 500,
    error: error.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : error.message
  })
})
```

---

## Monitoring & Observability

### Sentry Setup (`apps/web/src/lib/sentry.ts`)

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  
  // Don't send errors in development
  enabled: process.env.NODE_ENV === 'production',
  
  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return event
  }
})
```

### Structured Logging (`apps/api/src/lib/logger.ts`)

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Redact sensitive fields
  redact: {
    paths: ['password', 'token', 'authorization'],
    remove: true
  }
})

// Usage
logger.info({
  event: 'bin_started',
  binId: 'BIN-001',
  facilityId: 'chicago',
  userId: 'user-123'
})
```

---

## Scalability Path

### Phase 1: MVP (Current) — 5 Facilities, ~50 Bins
**Stack:** Supabase + Vercel  
**Cost:** ~$25/month  
**Handles:** 1,000 req/day, 50 concurrent users

### Phase 2: Growth (6-12 months) — 20 Facilities, ~500 Bins
**Add:** Redis caching (Upstash)  
**Why:** Reduce database load for dashboard queries  
**Cost:** ~$75/month  
**Handles:** 10,000 req/day, 200 concurrent users

```typescript
// Cache active bins for 30 seconds
const cachedBins = await redis.get('active-bins')
if (cachedBins) return JSON.parse(cachedBins)

const bins = await prisma.binCycle.findMany({ ... })
await redis.setex('active-bins', 30, JSON.stringify(bins))
return bins
```

### Phase 3: Scale (12-24 months) — 50 Facilities, ~2000 Bins
**Add:** BullMQ queue system  
**Why:** Offload Cardano anchoring to background jobs  
**Cost:** ~$200/month  
**Handles:** 100,000 req/day, 1000 concurrent users

```typescript
// Queue daily NFT minting
await binQueue.add('mint-daily-nft', {
  date: new Date().toISOString(),
  cycles: completedCycles
}, {
  repeat: { cron: '0 0 * * *' } // Daily at midnight
})
```

### Phase 4: Enterprise (24+ months) — 100+ Facilities, 10,000+ Bins
**Migrate:** Microservices + Kubernetes  
**Add:** Dedicated Cardano node  
**Cost:** ~$1000+/month  
**Handles:** 1M+ req/day, 10,000+ concurrent users

---

## Cost Breakdown

| Phase | Facilities | Bins | Monthly Cost | Services |
|-------|-----------|------|--------------|----------|
| MVP | 5 | 50 | $25 | Supabase Pro + Vercel |
| Growth | 20 | 500 | $75 | + Upstash Redis |
| Scale | 50 | 2,000 | $200 | + BullMQ + CDN |
| Enterprise | 100+ | 10,000+ | $1,000+ | + Kubernetes + Cardano node |

---

## Next Steps

1. ✅ Set up monorepo structure (Turborepo)
2. ✅ Configure TypeScript (strict mode)
3. ✅ Set up Supabase project
4. ✅ Create Prisma schema
5. ✅ Set up tRPC routers
6. ✅ Create Next.js app structure
7. ✅ Set up CI/CD pipeline
8. ✅ Configure Sentry monitoring
9. ✅ Create local development environment (Docker Compose)
10. ✅ Write first tests

**Ready to start building!** 🚀
