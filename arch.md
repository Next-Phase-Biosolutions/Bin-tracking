# Full-System Architecture Plan — Meat Processing Traceability Platform
> Status: PLANNING | Created: 2026-04-17

---

## Context

The current codebase is a production-quality **bin tracking system for Stage 9 (By-Products)** —
organ bins tracked from slaughterhouse to rendering facility, with Cardano blockchain anchoring.

The CEO has decided to build the **entire 11-stage meat processing ERP in-house**, competing
directly with inecta. The system must cover every stage from live animal intake (Stage 1) through
government recall readiness (Stage 11), while preserving the existing Stage 9 bin system and
Cardano blockchain moat.

**Decision context:**
- Multi-facility SaaS (multiple slaughterhouses as clients)
- 5 roles: ADMIN, OPS_MANAGER, DRIVER, WORKER, INSPECTOR
- Single React web app, role-based navigation (workers pick their stage from a menu)
- Online-only to start (offline-first deferred)
- Manual temperature entry (IoT sensor integration deferred)
- Blockchain anchors once at LotBatch close (all 11 stages complete)
- Architecture: Domain Modules within the existing monolith (Approach 2)

---

## Architecture Overview

```
bin-tracker/ (Turborepo monorepo)
├── apps/
│   ├── api/          ← Fastify + tRPC (domain modules, expanded)
│   └── web/          ← Vite + React (role-based stage navigation, expanded)
└── packages/
    ├── db/           ← Prisma schema (8 → 29 models)
    ├── types/        ← Shared TypeScript types (expanded)
    └── validators/   ← Zod schemas (expanded)
```

One database. One API. One frontend app. Organized internally by domain modules.

---

## Section 1 — Codebase Restructure (API)

Move from flat routers/services to domain module folders.

### Before (current)
```
apps/api/src/
├── routers/
│   ├── facility.router.ts
│   ├── bin.router.ts
│   ├── cycle.router.ts
│   ├── dashboard.router.ts
│   ├── blockchain.router.ts
│   └── farmer.router.ts
└── services/
    ├── facility.service.ts
    ├── bin.service.ts
    ├── cycle.service.ts
    ├── dashboard.service.ts
    ├── blockchain.service.ts
    └── farmer.service.ts
```

### After (domain modules)
```
apps/api/src/
├── modules/
│   ├── facility/                 ← move existing
│   │   ├── facility.router.ts
│   │   └── facility.service.ts
│   ├── by-products/              ← move existing bin + cycle + blockchain
│   │   ├── bin.router.ts
│   │   ├── bin.service.ts
│   │   ├── cycle.router.ts
│   │   ├── cycle.service.ts
│   │   ├── blockchain.router.ts
│   │   └── blockchain.service.ts
│   ├── dashboard/                ← move existing
│   │   ├── dashboard.router.ts
│   │   └── dashboard.service.ts
│   ├── lot-batch/                ← NEW Phase 1
│   │   ├── farm.router.ts
│   │   ├── farm.service.ts
│   │   ├── lotBatch.router.ts
│   │   ├── lotBatch.service.ts
│   │   ├── animal.router.ts      ← replaces farmer.router.ts
│   │   └── animal.service.ts     ← replaces farmer.service.ts
│   ├── slaughter/                ← NEW Phase 2
│   │   ├── slaughter.router.ts
│   │   └── slaughter.service.ts
│   ├── inspection/               ← NEW Phase 2
│   │   ├── carcass.router.ts
│   │   ├── carcass.service.ts
│   │   ├── inspection.router.ts
│   │   └── inspection.service.ts
│   ├── cold-chain/               ← NEW Phase 3
│   │   ├── coldStorage.router.ts
│   │   ├── coldStorage.service.ts
│   │   ├── temperature.router.ts
│   │   └── temperature.service.ts
│   ├── fabrication/              ← NEW Phase 3
│   │   ├── primalCut.router.ts
│   │   ├── primalCut.service.ts
│   │   ├── packaging.router.ts
│   │   └── packaging.service.ts
│   ├── inventory/                ← NEW Phase 3
│   │   ├── inventory.router.ts
│   │   └── inventory.service.ts
│   ├── sales/                    ← NEW Phase 4
│   │   ├── customer.router.ts
│   │   ├── customer.service.ts
│   │   ├── salesOrder.router.ts
│   │   ├── salesOrder.service.ts
│   │   ├── dispatch.router.ts
│   │   └── dispatch.service.ts
│   └── compliance/               ← NEW Phase 4
│       ├── haccp.router.ts
│       ├── haccp.service.ts
│       ├── recall.router.ts
│       ├── recall.service.ts
│       ├── sanitation.router.ts
│       └── sanitation.service.ts
├── trpc/                         ← unchanged
│   ├── context.ts
│   ├── trpc.ts
│   └── middleware.ts
├── lib/                          ← unchanged
│   ├── countdown.ts
│   ├── compliance.ts
│   ├── errors.ts
│   ├── jwt.ts
│   └── supabase.ts
└── server.ts                     ← update appRouter to include all new modules
```

The root `appRouter` in `server.ts` registers all module routers. No other structural change.

---

## Section 2 — Prisma Schema Changes

### 2a — Enum Additions

```prisma
# Add to existing UserRole enum:
enum UserRole {
  ADMIN
  OPS_MANAGER
  DRIVER
  WORKER
  INSPECTOR          ← NEW
}

# Add to existing FacilityType enum:
enum FacilityType {
  PROCESSING
  RENDERING
  FARM               ← NEW (supplier farms registered as facilities)
}

# New enums:
enum LotStatus {
  RECEIVING          # Stage 1 - animals arriving
  SLAUGHTERING       # Stage 2
  INSPECTION         # Stage 3 - awaiting CFIA sign-off
  CHILLING           # Stage 5
  FABRICATING        # Stage 6
  PROCESSING         # Stage 7
  INVENTORY          # Stage 8
  DISPATCHED         # Stage 10 - all orders shipped
  CLOSED             # All stages done, ready to anchor
  ANCHORED           # On Cardano blockchain
}

enum CarcassStatus {
  PENDING_INSPECTION
  PASSED
  RETAINED
  CONDEMNED
  IN_CHILL
  FABRICATED
}

enum CarcassGrade {
  A
  AA
  AAA
  PRIME
  UNGRADED
}

enum StunningMethod {
  CAPTIVE_BOLT
  ELECTRICAL
  GAS
}

enum InspectionDecision {
  PASS
  RETAIN
  CONDEMN
}

enum CutType {
  CHUCK
  RIB
  LOIN
  ROUND
  BRISKET
  SHANK
  FLANK
  PLATE
  OTHER
}

enum PackageFormat {
  RETAIL
  WHOLESALE
  FOODSERVICE
  BULK
}

enum InventoryStatus {
  IN_STOCK
  RESERVED
  SOLD
}

enum OrderStatus {
  PENDING
  FULFILLED
  DISPATCHED
  CANCELLED
}
```

### 2b — New Models (20 new, current total 9 → 29)

```prisma
# ─── STAGE 1: TRACEABILITY SPINE ──────────────────────────────────────────

model Farm {
  id            String    @id @default(cuid())
  facilityId    String                          # which processing facility they supply
  name          String
  address       String
  contactName   String
  contactPhone  String?
  licenseNo     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  facility      Facility  @relation(fields: [facilityId], references: [id])
  animals       Animal[]
  lotBatches    LotBatch[]

  @@index([facilityId])
  @@map("farms")
}

model LotBatch {
  id              String      @id @default(cuid())
  lotNumber       String      @unique         # LOT-YYYY-MMDD-XXXX
  facilityId      String
  farmId          String
  species         String                      # BEEF / PORK / LAMB
  animalCount     Int
  liveWeightKg    Float
  arrivalAt       DateTime
  status          LotStatus   @default(RECEIVING)
  closedAt        DateTime?
  anchored        Boolean     @default(false)
  anchorTxHash    String?
  merkleRoot      String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  facility        Facility    @relation(fields: [facilityId], references: [id])
  farm            Farm        @relation(fields: [farmId], references: [id])
  animals         Animal[]
  carcasses       Carcass[]
  haccpRecords    HaccpRecord[]
  binCycles       BinCycle[]  # Stage 9 link
  inventoryItems  InventoryItem[]
  orderLines      OrderLine[]
  carbonCredits   CarbonCredit[]
  sanitationLogs  SanitationLog[]

  @@index([facilityId])
  @@index([status])
  @@index([arrivalAt])
  @@map("lot_batches")
}

model Animal {
  id              String    @id @default(cuid())
  lotBatchId      String
  facilityId      String
  farmId          String
  tagNumber       String                      # RFID/ear tag
  species         String
  breed           String?
  liveWeightKg    Float
  healthStatus    String?
  rawTranscript   String?                     # voice intake transcript
  createdAt       DateTime  @default(now())

  lotBatch        LotBatch  @relation(fields: [lotBatchId], references: [id])
  facility        Facility  @relation(fields: [facilityId], references: [id])
  farm            Farm      @relation(fields: [farmId], references: [id])
  slaughterRecord SlaughterRecord?
  carcass         Carcass?

  @@unique([facilityId, tagNumber])
  @@index([lotBatchId])
  @@map("animals")
}

# ─── STAGE 2: SLAUGHTER ──────────────────────────────────────────────────

model SlaughterRecord {
  id                String          @id @default(cuid())
  animalId          String          @unique
  lotBatchId        String
  facilityId        String
  operatorId        String
  stunningMethod    StunningMethod
  stickingAt        DateTime
  bleedOutMinutes   Float
  evisceratedAt     DateTime?
  notes             String?
  createdAt         DateTime        @default(now())

  animal            Animal          @relation(fields: [animalId], references: [id])
  operator          User            @relation(fields: [operatorId], references: [id])

  @@index([lotBatchId])
  @@index([facilityId])
  @@map("slaughter_records")
}

# ─── STAGE 3 + 4: CARCASS & INSPECTION ───────────────────────────────────

model Carcass {
  id              String          @id @default(cuid())
  animalId        String          @unique
  lotBatchId      String
  facilityId      String
  status          CarcassStatus   @default(PENDING_INSPECTION)
  hcwKg           Float?          # hot carcass weight (set Stage 4)
  grade           CarcassGrade?   # set Stage 4
  barcodeId       String?         @unique
  splitType       String?         # HALF / QUARTER
  pH              Float?
  temperatureC    Float?
  gradedAt        DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  animal          Animal          @relation(fields: [animalId], references: [id])
  lotBatch        LotBatch        @relation(fields: [lotBatchId], references: [id])
  facility        Facility        @relation(fields: [facilityId], references: [id])
  inspection      CarcassInspection?
  chillRecord     CarcassChill?
  primalCuts      PrimalCut[]

  @@index([lotBatchId])
  @@index([status])
  @@map("carcasses")
}

model CarcassInspection {
  id              String              @id @default(cuid())
  carcassId       String              @unique
  inspectorId     String
  decision        InspectionDecision
  organResults    Json?               # { liver: PASS, heart: PASS, kidneys: RETAIN }
  stampCode       String?
  dispositionNote String?             # if RETAIN or CONDEMN
  inspectedAt     DateTime
  createdAt       DateTime            @default(now())

  carcass         Carcass             @relation(fields: [carcassId], references: [id])
  inspector       User                @relation(fields: [inspectorId], references: [id])

  @@index([inspectorId])
  @@map("carcass_inspections")
}

# HACCP — cross-cutting, gates Stages 3/4/5/11

model HaccpRecord {
  id                String    @id @default(cuid())
  facilityId        String
  lotBatchId        String
  stageNumber       Int                       # 3, 4, 5, or 11
  ccpType           String                    # e.g. "CORE_TEMP", "PH", "BLEED_TIME"
  measuredValue     Float
  unit              String                    # °C, pH, min
  lowerLimit        Float?
  upperLimit        Float?
  passed            Boolean
  deviationNotes    String?
  correctiveAction  String?
  recordedById      String
  recordedAt        DateTime
  createdAt         DateTime  @default(now())

  facility          Facility  @relation(fields: [facilityId], references: [id])
  lotBatch          LotBatch  @relation(fields: [lotBatchId], references: [id])
  recordedBy        User      @relation(fields: [recordedById], references: [id])

  @@index([lotBatchId])
  @@index([facilityId, stageNumber])
  @@map("haccp_records")
}

# ─── STAGE 5: CHILLING & AGING ────────────────────────────────────────────

model ColdStorage {
  id              String    @id @default(cuid())
  facilityId      String
  name            String
  type            String                      # COOLER / FREEZER
  capacityKg      Float?
  targetTempC     Float
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  facility        Facility          @relation(fields: [facilityId], references: [id])
  chillRecords    CarcassChill[]
  tempLogs        TemperatureLog[]
  inventoryItems  InventoryItem[]

  @@index([facilityId])
  @@map("cold_storages")
}

model CarcassChill {
  id              String      @id @default(cuid())
  carcassId       String      @unique
  lotBatchId      String
  coldStorageId   String
  entryAt         DateTime
  entryTempC      Float?
  ccwKg           Float?      # cold carcass weight (yield/shrink vs HCW)
  agingDays       Int?
  exitAt          DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  carcass         Carcass     @relation(fields: [carcassId], references: [id])
  coldStorage     ColdStorage @relation(fields: [coldStorageId], references: [id])

  @@index([lotBatchId])
  @@map("carcass_chills")
}

model TemperatureLog {
  id              String      @id @default(cuid())
  coldStorageId   String
  lotBatchId      String?
  recordedById    String
  temperatureC    Float
  recordedAt      DateTime
  createdAt       DateTime    @default(now())

  coldStorage     ColdStorage @relation(fields: [coldStorageId], references: [id])
  recordedBy      User        @relation(fields: [recordedById], references: [id])

  @@index([coldStorageId, recordedAt])
  @@index([lotBatchId])
  @@map("temperature_logs")
}

# ─── STAGE 6: FABRICATION ─────────────────────────────────────────────────

model PrimalCut {
  id              String    @id @default(cuid())
  carcassId       String
  lotBatchId      String
  facilityId      String
  cutType         CutType
  weightKg        Float
  boneIn          Boolean   @default(true)
  trimWeightKg    Float?
  operatorId      String
  cutAt           DateTime
  createdAt       DateTime  @default(now())

  carcass         Carcass         @relation(fields: [carcassId], references: [id])
  operator        User            @relation(fields: [operatorId], references: [id])
  packagedProducts PackagedProduct[]

  @@index([carcassId])
  @@index([lotBatchId])
  @@map("primal_cuts")
}

# ─── STAGE 7: FURTHER PROCESSING ─────────────────────────────────────────

model PackagedProduct {
  id              String          @id @default(cuid())
  primalCutId     String
  lotBatchId      String
  facilityId      String
  productName     String
  format          PackageFormat
  weightKg        Float
  useByDate       DateTime
  allergens       String[]        # ["GLUTEN", "SOY"]
  operatorId      String
  packagedAt      DateTime
  createdAt       DateTime        @default(now())

  primalCut       PrimalCut       @relation(fields: [primalCutId], references: [id])
  operator        User            @relation(fields: [operatorId], references: [id])
  inventoryItem   InventoryItem?

  @@index([lotBatchId])
  @@index([facilityId])
  @@map("packaged_products")
}

# ─── STAGE 8: INVENTORY ───────────────────────────────────────────────────

model InventoryItem {
  id                String          @id @default(cuid())
  packagedProductId String          @unique
  lotBatchId        String
  facilityId        String
  coldStorageId     String?
  skuCode           String
  costPerKg         Float?
  currentWeightKg   Float
  fifoDate          DateTime        # = packagedAt for FEFO ordering
  status            InventoryStatus @default(IN_STOCK)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  packagedProduct   PackagedProduct @relation(fields: [packagedProductId], references: [id])
  lotBatch          LotBatch        @relation(fields: [lotBatchId], references: [id])
  coldStorage       ColdStorage?    @relation(fields: [coldStorageId], references: [id])
  orderLines        OrderLine[]

  @@index([lotBatchId])
  @@index([facilityId, status])
  @@index([fifoDate])
  @@map("inventory_items")
}

# ─── STAGE 9: BY-PRODUCTS ─────────────────────────────────────────────────
# Extend existing BinCycle: add lotBatchId FK (nullable for backward compat)
# + add CarbonCredit model

model CarbonCredit {
  id                  String    @id @default(cuid())
  lotBatchId          String
  facilityId          String
  byProductType       String    # OFFAL / BLOOD / TALLOW / BONE_MEAL / HIDE
  weightKg            Float
  destinationFacilityId String?
  emissionFactor      Float?    # kg CO2e per kg by-product
  creditValue         Float?    # calculated offset value
  calculatedAt        DateTime
  createdAt           DateTime  @default(now())

  lotBatch            LotBatch  @relation(fields: [lotBatchId], references: [id])

  @@index([lotBatchId])
  @@map("carbon_credits")
}

# ─── STAGE 10: SALES & DISPATCH ───────────────────────────────────────────

model Customer {
  id            String    @id @default(cuid())
  facilityId    String
  name          String
  contactName   String?
  email         String?
  phone         String?
  address       String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  facility      Facility  @relation(fields: [facilityId], references: [id])
  orders        SalesOrder[]

  @@index([facilityId])
  @@map("customers")
}

model SalesOrder {
  id            String      @id @default(cuid())
  facilityId    String
  customerId    String
  orderNumber   String      @unique         # ORD-YYYY-MMDD-XXXX
  status        OrderStatus @default(PENDING)
  createdById   String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  facility      Facility        @relation(fields: [facilityId], references: [id])
  customer      Customer        @relation(fields: [customerId], references: [id])
  createdBy     User            @relation(fields: [createdById], references: [id])
  lines         OrderLine[]
  dispatch      DispatchRecord?

  @@index([facilityId, status])
  @@map("sales_orders")
}

model OrderLine {
  id                String        @id @default(cuid())
  orderId           String
  inventoryItemId   String
  lotBatchId        String
  quantityKg        Float
  pricePerKg        Float?
  createdAt         DateTime      @default(now())

  order             SalesOrder    @relation(fields: [orderId], references: [id])
  inventoryItem     InventoryItem @relation(fields: [inventoryItemId], references: [id])
  lotBatch          LotBatch      @relation(fields: [lotBatchId], references: [id])

  @@index([orderId])
  @@index([lotBatchId])
  @@map("order_lines")
}

model DispatchRecord {
  id              String    @id @default(cuid())
  orderId         String    @unique
  facilityId      String
  carrier         String?
  bolNumber       String?                   # Bill of Lading number
  dispatchedAt    DateTime
  tempAtDispatch  Float?
  trackingNumber  String?
  dispatchedById  String
  createdAt       DateTime  @default(now())

  order           SalesOrder @relation(fields: [orderId], references: [id])
  dispatchedBy    User       @relation(fields: [dispatchedById], references: [id])

  @@map("dispatch_records")
}

# ─── STAGE 11: COMPLIANCE ─────────────────────────────────────────────────

model SanitationLog {
  id            String    @id @default(cuid())
  facilityId    String
  lotBatchId    String?
  operatorId    String
  area          String                      # "Kill Floor", "Cooler A"
  method        String                      # "Chemical", "Steam"
  completedAt   DateTime
  inspectorId   String?
  notes         String?
  createdAt     DateTime  @default(now())

  facility      Facility  @relation(fields: [facilityId], references: [id])
  operator      User      @relation(fields: [operatorId], references: [id])

  @@index([facilityId])
  @@map("sanitation_logs")
}

model StaffTrainingRecord {
  id              String    @id @default(cuid())
  userId          String
  facilityId      String
  trainingType    String                    # "HACCP", "FOOD_SAFETY", "KNIFE_SAFETY"
  completedAt     DateTime
  certExpiry      DateTime?
  createdAt       DateTime  @default(now())

  user            User      @relation(fields: [userId], references: [id])
  facility        Facility  @relation(fields: [facilityId], references: [id])

  @@index([userId])
  @@index([facilityId])
  @@map("staff_training_records")
}
```

### 2c — Existing Model Extensions

| Model | Change |
|---|---|
| `BinCycle` | Add `lotBatchId String?` FK → `LotBatch` (nullable for backward compat) |
| `AnimalRegistration` | Deprecate — replaced by `Animal` model. Keep existing rows. |
| `Facility` | Add `FARM` to `FacilityType` enum |

---

## Section 3 — tRPC Router Plan (per module)

Each module follows the same pattern as existing routers:
- Input validated with Zod (in `packages/validators/`)
- Business logic in `*.service.ts`
- Auth via existing procedure types (`protectedProcedure`, `adminProcedure`, etc.)
- Errors via existing `handlePrismaError()` in `lib/errors.ts`

| Module | Key Procedures | Auth |
|---|---|---|
| `farm` | `create`, `update`, `list`, `getById` | `opsManagerProcedure` / `protectedProcedure` |
| `lotBatch` | `create`, `getById`, `list`, `close`, `traceForward`, `traceBackward` | `protectedProcedure` |
| `animal` | `register` (voice+form), `list`, `getById` | `protectedProcedure` |
| `slaughter` | `record`, `getByAnimal`, `getByLot` | `protectedProcedure` (WORKER) |
| `carcass` | `create`, `grade`, `weigh`, `list`, `getById` | `protectedProcedure` (WORKER) |
| `inspection` | `pass`, `retain`, `condemn`, `getByLot` | `inspectorProcedure` (NEW) |
| `haccp` | `logCCP`, `recordDeviation`, `recordCorrectiveAction`, `getByLot` | `protectedProcedure` |
| `coldStorage` | `create`, `list`, `assign`, `recordCCW` | `protectedProcedure` |
| `temperature` | `log`, `getByStorage`, `getByLot` | `protectedProcedure` |
| `primalCut` | `createCut`, `listByLot`, `listByCarcass` | `protectedProcedure` (WORKER) |
| `packaging` | `package`, `assignUseBy`, `declareAllergens` | `protectedProcedure` (WORKER) |
| `inventory` | `list`, `reserve`, `fifoAllocate` | `opsManagerProcedure` |
| `carbonCredit` | `calculate`, `getByLot` | `protectedProcedure` |
| `customer` | `create`, `update`, `list`, `getById` | `opsManagerProcedure` |
| `salesOrder` | `create`, `addLine`, `fulfill`, `dispatch`, `generateBOL` | `opsManagerProcedure` |
| `compliance` | `logSanitation`, `logTraining`, `getAuditTrail` | `protectedProcedure` |
| `recall` | `traceForward`, `traceBackward` | `protectedProcedure` |
| `blockchain` | extend existing: `anchorLotBatch`, `confirmLotAnchor` | `adminProcedure` |

### New procedure type needed
```typescript
// Add to apps/api/src/trpc/trpc.ts
const inspectorProcedure = protectedProcedure.use(requireRole('INSPECTOR', 'ADMIN'));
```

---

## Section 4 — Frontend Structure

Single `apps/web` app. All roles log in at the same URL. Role-based routing shows/hides pages.

### New routes added to App.tsx

```
/app/lot-batch/new              ← WORKER: create lot at truck arrival
/app/lot-batch/:id              ← ALL: lot detail + stage progress tracker
/app/farms                      ← OPS_MANAGER/ADMIN: farm/supplier management
/app/animals/:lotId             ← WORKER: animal intake list for a lot
/app/slaughter/:lotId           ← WORKER: slaughter recording form
/app/inspection                 ← INSPECTOR: queue of carcasses awaiting decision
/app/inspection/:carcassId      ← INSPECTOR: post-mortem decision form
/app/carcass/:id                ← WORKER: grading + HCW entry
/app/cooler                     ← WORKER: cold storage + temperature log
/app/fabrication/:lotId         ← WORKER: cut sheet entry per carcass
/app/packaging                  ← WORKER: packaging form
/app/inventory                  ← OPS_MANAGER: FIFO/FEFO stock view
/app/customers                  ← OPS_MANAGER/ADMIN: customer management
/app/orders                     ← OPS_MANAGER: order management
/app/dispatch/:orderId          ← OPS_MANAGER: bill of lading + dispatch
/app/compliance                 ← INSPECTOR/OPS_MANAGER: HACCP logs
/app/recall                     ← ANY: lot trace forward/backward lookup
```

### New StageNav component
A role-aware navigation menu (sidebar or top nav) showing only stages relevant to the
logged-in user's role. WORKER sees Stages 1–9. INSPECTOR sees Stages 1, 3, 11. OPS_MANAGER
sees all. DRIVER sees Stage 9 only.

```
apps/web/src/
├── features/
│   ├── [existing features unchanged]
│   ├── lot-batch/
│   │   ├── LotCreatePage.tsx
│   │   ├── LotDetailPage.tsx
│   │   └── FarmManagePage.tsx
│   ├── animal-intake/
│   │   └── AnimalIntakePage.tsx    ← absorbs FarmerRegistrationPage
│   ├── slaughter/
│   │   └── SlaughterPage.tsx
│   ├── inspection/
│   │   ├── InspectorQueuePage.tsx
│   │   └── PostMortemPage.tsx
│   ├── carcass/
│   │   └── CarcassProcessingPage.tsx
│   ├── cold-chain/
│   │   ├── CoolerManagePage.tsx
│   │   └── TemperatureLogPage.tsx
│   ├── fabrication/
│   │   └── CutSheetPage.tsx
│   ├── packaging/
│   │   └── PackagingPage.tsx
│   ├── inventory/
│   │   └── InventoryPage.tsx
│   ├── sales/
│   │   ├── CustomerPage.tsx
│   │   ├── OrderPage.tsx
│   │   └── DispatchPage.tsx
│   └── compliance/
│       ├── HaccpLogPage.tsx
│       ├── RecallPage.tsx
│       └── AuditPage.tsx
└── components/
    └── StageNav.tsx              ← NEW role-based stage navigation
```

---

## Section 5 — Cross-Cutting Concerns

### 5a — HACCP Gating (Stage 3 hard gate)

The `CarcassInspection.decision` field controls whether a carcass progresses:
- `PASS` → carcass status → `IN_CHILL`, lot continues
- `RETAIN` → carcass flagged, held for re-inspection, lot can continue for other carcasses
- `CONDEMN` → carcass removed from lot, weight deducted, `SanitationLog` auto-created

Implementation: `carcass.service.ts` checks for `CarcassInspection` existence and `PASS`
decision before allowing any Stage 4+ operations on that carcass. Returns `FORBIDDEN` if
inspection not completed.

### 5b — Blockchain Anchoring at LotBatch Close

When `lotBatch.close()` is called (all orders dispatched):
1. Collect: all `HaccpRecord`, `CarcassInspection`, `SlaughterRecord`, `TemperatureLog`,
   `DispatchRecord` for this lot
2. Build canonical JSON per record (same pattern as existing `blockchain.service.ts`)
3. Build Merkle root from all record hashes
4. Store `LotBatch.merkleRoot`
5. Set `LotBatch.status = CLOSED` (ready for anchoring)
6. Admin triggers anchor from dashboard → mints CIP-25 NFT with lot metadata + Merkle root
7. `blockchain.confirmLotAnchor` stores `anchorTxHash`, sets `LotBatch.anchored = true`

Reuses existing: `merkle.ts` (buildMerkleRoot), `blockchain.service.ts` patterns,
`BlockchainAnchorModal.tsx` (extend for lots).

### 5c — Carbon MRV (Stage 9 → LotBatch link)

When a `BinCycle` is completed for a lot:
- `carbonCredit.calculate(lotBatchId)` aggregates all completed bin cycles for the lot
- Groups by `binType.organType` → emission factor lookup
- Stores `CarbonCredit` records per by-product stream
- Included in LotBatch blockchain anchor payload

### 5d — Recall Engine (Stage 11)

Pure database queries — no special logic needed if schema is correct:

```typescript
// Forward trace: who received product from lot LOT-2026-0412?
traceForward(lotId) → {
  customers: OrderLine → SalesOrder → Customer (where lotBatchId = lotId)
  dispatchDates: DispatchRecord dates
}

// Backward trace: which farm/animals produced product in this lot?
traceBackward(lotId) → {
  farm: LotBatch → Farm
  animals: Animal[] where lotBatchId = lotId
  inspectionDecisions: CarcassInspection[] for all carcasses in lot
}
```

---

## Section 6 — Build Phases

### Phase 1 — Traceability Spine *(prerequisite for everything)*
**Deliverables:**
- Add `INSPECTOR` to `UserRole` enum + migration
- Add `Farm`, `LotBatch`, `Animal` models + migrations
- Add `inspectorProcedure` to `trpc.ts`
- Restructure existing routers into `modules/` folders (no behavior change)
- `modules/lot-batch/`: farm router+service, lotBatch router+service, animal router+service
- Frontend: `LotCreatePage`, `LotDetailPage`, `FarmManagePage`, `AnimalIntakePage` (absorbs FarmerRegistrationPage), `StageNav`

**Critical files to modify:**
- `packages/db/prisma/schema.prisma` — add enums + 3 new models
- `apps/api/src/trpc/trpc.ts` — add `inspectorProcedure`
- `apps/api/src/server.ts` — update `appRouter` as modules are added
- `apps/web/src/App.tsx` — add new routes
- `packages/validators/src/` — add farm, lotBatch, animal schemas
- `packages/types/src/` — add farm, lotBatch, animal types

### Phase 2 — Slaughter & Inspection Pipeline
**Deliverables:**
- `SlaughterRecord`, `Carcass`, `CarcassInspection`, `HaccpRecord` models + migrations
- `modules/slaughter/`, `modules/inspection/`
- HACCP gating logic in `carcass.service.ts`
- Frontend: `SlaughterPage`, `InspectorQueuePage`, `PostMortemPage`, `CarcassProcessingPage`

### Phase 3 — Cold Chain, Fabrication & Inventory
**Deliverables:**
- `ColdStorage`, `CarcassChill`, `TemperatureLog`, `PrimalCut`, `PackagedProduct`, `InventoryItem` models + migrations
- `modules/cold-chain/`, `modules/fabrication/`, `modules/inventory/`
- Frontend: `CoolerManagePage`, `TemperatureLogPage`, `CutSheetPage`, `PackagingPage`, `InventoryPage`

### Phase 4 — Sales, Dispatch, Carbon MRV & Recall
**Deliverables:**
- `Customer`, `SalesOrder`, `OrderLine`, `DispatchRecord`, `SanitationLog`, `StaffTrainingRecord`, `CarbonCredit` models + migrations
- Extend `BinCycle` with `lotBatchId`
- `modules/sales/`, `modules/compliance/`, `modules/carbonCredit/`
- Extend `modules/by-products/` blockchain service for lot-close anchoring
- Frontend: `CustomerPage`, `OrderPage`, `DispatchPage`, `HaccpLogPage`, `RecallPage`, `AuditPage`
- Extend `BlockchainAnchorModal.tsx` for lot anchoring

---

## Section 7 — Critical Files

### Files to modify (existing)
| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | Add all new enums + 20 new models, extend BinCycle |
| `apps/api/src/server.ts` | Import + register all new module routers in appRouter |
| `apps/api/src/trpc/trpc.ts` | Add `inspectorProcedure` |
| `apps/web/src/App.tsx` | Add all new routes |
| `apps/web/src/context/AuthContext.tsx` | Add INSPECTOR to role type |
| `packages/types/src/user.ts` | Add INSPECTOR to UserRole type |

### Files to create (new)
All files listed in Section 1 (API module structure) and Section 4 (frontend features).

### Files to reuse patterns from
| Pattern | Source file |
|---|---|
| Serializable transactions | `apps/api/src/services/bin.service.ts` |
| Cursor pagination | `apps/api/src/services/cycle.service.ts` |
| Merkle tree + blockchain | `apps/api/src/services/blockchain.service.ts` |
| Voice transcription + AI extraction | `apps/api/src/services/farmer.service.ts` |
| Error handling | `apps/api/src/lib/errors.ts` |
| Facility scoping | `apps/api/src/trpc/middleware.ts` → `getUserFacilityIds()` |
| QR scanner component | `apps/web/src/components/QRScanner.tsx` |

---

## Section 8 — Verification (per phase)

After each phase:
1. `pnpm --filter @bin-tracker/db prisma migrate dev` — migration runs clean
2. `pnpm --filter @bin-tracker/api build` — TypeScript compiles
3. `pnpm --filter @bin-tracker/web build` — frontend compiles
4. Manual E2E: create a lot → progress through new stage → verify data in DB via Prisma Studio
5. Existing Stage 9 bin flow still works end-to-end (regression check)
6. `pnpm --filter @bin-tracker/api test` (when tests are added per TDD workflow)

---

## Summary

| Metric | Before | After |
|---|---|---|
| Prisma models | 9 | 29 |
| tRPC routers | 6 | ~20 |
| Frontend pages | 4 app pages | ~20 app pages |
| Stages covered | Stage 9 (~90%) | All 11 stages |
| User roles | 4 | 5 (+INSPECTOR) |
| Build phases | — | 4 phases |
