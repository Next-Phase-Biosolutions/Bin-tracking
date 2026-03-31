# Bin Tracker — Project Architecture

---

## Table of Contents

1. [Enums](#1-enums)
2. [Concurrency Design](#2-concurrency-design)
3. [Organ Types & DK Times](#3-organ-types--dk-times)
4. [Bin Lifecycle (State Machine)](#4-bin-lifecycle-state-machine)
5. [API Layer](#5-api-layer)
6. [Services](#6-services)
7. [Blockchain Anchoring Flow](#7-blockchain-anchoring-flow)
8. [Web Frontend](#8-web-frontend-appsweb)
9. [Key Design Patterns](#9-key-design-patterns)
10. [Environment Variables](#10-environment-variables-key)
11. [Known Design Notes & Gaps](#11-known-design-notes--gaps)

---

## 1. Enums

| Enum | Values |
|---|---|
| `FacilityType` | `PROCESSING` \| `RENDERING` |
| `BinStatus` | `IDLE` \| `ACTIVE` \| `IN_TRANSIT` |
| `CycleStatus` | `ACTIVE` \| `IN_TRANSIT` \| `COMPLETED` |
| `ComplianceResult` | `ON_TIME` \| `LATE` |
| `Urgency` | `CRITICAL` \| `MEDIUM` \| `STANDARD` \| `LOW` |
| `EventType` | `BIN_STARTED` \| `PICKED_UP` \| `DELIVERED` |
| `UserRole` | `ADMIN` \| `OPS_MANAGER` \| `DRIVER` \| `WORKER` |

---

## 2. Concurrency Design

- **Serializable transactions** protect all state transitions.
- No duplicate active cycles per bin — enforced at the application level (Serializable isolation prevents TOCTOU).
- No partial unique index — relies on app logic.

---

## 3. Organ Types & DK Times

| Organ | DK Hours | Urgency | Bin Prefix |
|---|---|---|---|
| Heart | 4h | 🔴 CRITICAL | `BIN-HEART-` |
| Liver | 6h | 🔴 CRITICAL | `BIN-LIVER-` |
| Kidneys | 12h | 🟡 MEDIUM | `BIN-KIDNEY-` |
| Skin | 24h | 🟢 STANDARD | `BIN-SKIN-` |
| Bones | 48h | 🟢 LOW | `BIN-BONES-` |
| Fat | 24h | 🟢 STANDARD | `BIN-FAT-` |

> Clock starts at **Scan 1** and never resets.  
> `deadline = startedAt + dkHours`

---

## 4. Bin Lifecycle (State Machine)

```
SCAN 1              SCAN 2              SCAN 3
(Facility Tablet)   (Driver App)        (Driver App)
     │                   │                   │
     ▼                   ▼                   ▼
  IDLE ──► ACTIVE ──► IN_TRANSIT ──► COMPLETED (Bin resets to IDLE)
```

All state transitions run inside **Serializable Prisma transactions** and append an immutable `EventLog` entry.

| Scan | Who | Action | State Transition |
|---|---|---|---|
| 1 | Facility Tablet | Start bin | `IDLE → ACTIVE` |
| 2 | Driver | Pick up | `ACTIVE → IN_TRANSIT` |
| 3 | Driver | Deliver | `IN_TRANSIT → COMPLETED` |

---

## 5. API Layer

### Server (`apps/api/src/server.ts`)

- Fastify HTTP server on port **3001**
- Security: `@fastify/helmet`, `@fastify/cors`, rate-limit (100 req/min)
- Raw `GET /health` route (no auth)
- All business logic via **tRPC** at `/trpc`

### tRPC Routers (`apps/api/src/routers/`)

| Router | Key Procedures |
|---|---|
| `bin` | `start`, `startDynamic`, `getById`, `getByQrCode`, `getActiveDynamicMatches`, `list` |
| `cycle` | `pickup`, `deliver`, `getById`, `listActive`, `getHistory` |
| `facility` | `list`, `getById`, `create`, `update`, `remove` |
| `dashboard` | `getStats`, `getPriorityQueue`, `getOverdue` |
| `blockchain` | `getDailySummary`, `confirmAnchor` |

### Procedure Types

| Procedure | Protection |
|---|---|
| `publicProcedure` | No auth |
| `protectedProcedure` | Must have valid Supabase JWT user |
| `stationProcedure` | Must have valid Station token |
| `adminProcedure` | Role: `ADMIN` |
| `opsManagerProcedure` | Role: `ADMIN` or `OPS_MANAGER` |
| `driverProcedure` | Role: `ADMIN` or `DRIVER` |
| `facilityProcedure` | Authenticated + facility access middleware |
| `assignedDriverProcedure` | Driver or Admin role (cycle assignment checked in service) |

### Auth Strategy (`apps/api/src/trpc/context.ts`)

- `Authorization: Bearer <jwt>` → Verify Supabase token → look up `User` by `payload.sub`
- `Authorization: Station <token>` → Look up `Station` by token, include facility
- `DISABLE_AUTH=true` → Inject first ADMIN user + first station *(dev bypass)*

---

## 6. Services

### `bin.service.ts`

- **`start()`** — QR scan → find bin → validate `IDLE` status → create `BinCycle` → update `Bin.status = ACTIVE` → log `BIN_STARTED` event. Serializable transaction.
- **`startDynamic()`** — Scans a Master QR Code (e.g., `TYPE-HEART`) → creates a new dynamic `Bin` on-the-fly with a unique `qrCode` → creates cycle. For MVP where pre-labeled bins don't exist.
- **`getActiveDynamicMatches()`** — Resolves ambiguity when a Master QR is scanned during pickup — returns all active bins of that type accessible to the user.
- **`list()`** — Cursor pagination, filters by facility/status/binType.

### `cycle.service.ts`

- **`pickup()`** — `ACTIVE → IN_TRANSIT` — records `pickedUpAt`, `driverId`, `vehicleId`, GPS. Serializable tx.
- **`deliver()`** — `IN_TRANSIT → COMPLETED` — validates `destinationId` is a `RENDERING` facility, records `deliveredAt`, calculates `complianceResult` (`ON_TIME`/`LATE`), resets `Bin.status = IDLE`. Serializable tx.
- **`listActive()`** — Cursor-paginated, ordered by `deadline ASC` (most urgent first).
- **`getHistory()`** — All past cycles for a bin.

### `facility.service.ts`

- Full CRUD with soft-delete (`deletedAt` field).
- Non-`ADMIN` users can only see/modify their assigned facilities.

### `dashboard.service.ts`

- **`getStats()`** — Parallel queries for `totalActiveBins`, `totalOverdue`, `totalCompletedToday`, `complianceRate`, breakdown by facility and urgency (raw SQL for urgency grouping).
- **`getPriorityQueue()`** — All active cycles ordered `[status ASC, deadline ASC]` — most urgent first.
- **`getOverdue()`** — Active cycles past deadline.

### `blockchain.service.ts`

- **`getDailySummary(fromDate, toDate)`** — Fetches all completed cycles in range → `canonicalize()` each to stable JSON → `buildMerkleRoot(leaves)` → builds `cip25Payload` for Cardano CIP-25 NFT.
- **`confirmAnchor(cycleIds, txHash)`** — Idempotent — marks cycles `anchored=true`, stores `anchorTxHash`. Only updates where `anchored=false`.

---

## 7. Blockchain Anchoring Flow

```
1. Admin selects date range in dashboard
2. API: getDailySummary()
   ├── Fetch completed cycles from DB
   ├── Canonicalize each cycle to stable JSON (keys sorted)
   ├── Build Merkle tree (SHA-256, Bitcoin-style: odd nodes duplicate)
   ├── Compute Merkle root
   └── Return CIP-25 metadata payload + cycleIds
3. Frontend: user connects Cardano wallet (browser-side)
4. Frontend: submits NFT minting transaction with CIP-25 payload
5. On-chain: NFT minted with asset name e.g. BIN_OPS_20260209
6. API: confirmAnchor(cycleIds, txHash) → marks cycles anchored
```

### Merkle Tree (`apps/api/src/lib/merkle.ts`)

- Each **leaf** = `SHA256(canonicalized cycle JSON)`
- Pairs hashed together: `SHA256(left + right)`
- Odd number of nodes: last node duplicated *(Bitcoin-style)*
- `buildMerkleProof()` generates inclusion proofs for auditors

> **Critical invariant:** The `canonicalize()` function must never change after mainnet go-live, or all historical proofs break.

---

## 8. Web Frontend (`apps/web`)

**Stack:** Vite + React + TypeScript

### Feature Areas

| Feature File | Size | Purpose |
|---|---|---|
| `tablet/TabletPage.tsx` | ~11KB | Facility tablet: QR scan → BIN STARTED flow |
| `driver/DriverPage.tsx` | ~22KB | Driver mobile app: scan → PICKED UP / DELIVERED |
| `dashboard/DashboardPage.tsx` | ~32KB | Ops dashboard: KPIs, priority queue, overdue list |
| `dashboard/BlockchainAnchorModal.tsx` | ~41KB | Blockchain anchoring modal: date picker, Cardano wallet, confirm anchor |

### Pages

- `HomePage`, `AboutPage`, `ProcessPage`, `SolutionsPage` — marketing/info pages.

### Auth

- `/src/context/` contains auth context (Supabase).
- `main.tsx` wraps the app with tRPC + React Query providers.

---

## 9. Key Design Patterns

| Pattern | Where | Why |
|---|---|---|
| Serializable transactions | All state transitions | Prevent TOCTOU race conditions |
| Append-only `EventLog` | Every lifecycle event | Immutable audit trail |
| Cursor pagination | All list endpoints | Efficient over large datasets |
| Soft delete | Facilities | Preserve referential integrity |
| Auth bypass (`DISABLE_AUTH=true`) | Context + middleware | Dev/demo convenience |
| Facility-scoped access | Every query | Multi-facility data isolation |
| Idempotent writes | `confirmAnchor` | Safe retry on network error |
| Stable canonicalization | Blockchain service | Merkle proof correctness |

---

## 10. Environment Variables (Key)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SUPABASE_JWT_SECRET` | Verify Supabase JWTs |
| `DISABLE_AUTH` | Set `true` to bypass all auth *(dev only)* |
| `CORS_ORIGIN` | Allowed frontend origin |
| `CARDANO_NFT_IMAGE_CID` | IPFS CID for NFT image |
| `PORT` / `HOST` | API server bind |

---

## 11. Known Design Notes & Gaps

> [!NOTE]
> The duplicate-active-cycle prevention relies entirely on **Serializable transaction isolation**. The schema comment acknowledges a partial unique index could be added as an extra safety net but hasn't been.

> [!NOTE]
> `startDynamic()` generates QR codes with `Date.now()` + 3 random chars. Low collision risk in practice, but not cryptographically guaranteed unique under extreme concurrency.

> [!NOTE]
> `getDailySummary()` always returns `alreadyAnchored: false` — re-minting for any date range is currently allowed (MVP decision). Production should enforce one NFT per date range.

> [!NOTE]
> `dashboard.getPriorityQueue()` does not filter by active-only cycles — it fetches all cycles including `COMPLETED`. This may be intentional (full view) but could be a bug if the intent is to show only in-flight cycles.
