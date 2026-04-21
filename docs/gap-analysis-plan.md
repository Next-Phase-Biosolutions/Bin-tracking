# Bin Tracker — Gap Analysis & Implementation Plan
> Last updated: 2026-04-13
> Based on: CEO stage documentation + voice notes + full codebase review

---

## The Core Truth — What This System Is

The current codebase was built to solve **one specific problem**:
> Track by-product bins (hearts, livers, kidneys, etc.) from a processing facility to a rendering facility, within a DK (decay) time window, and anchor compliance records on the Cardano blockchain.

The CEO's 11-stage document expands this to a **full end-to-end meat processing traceability system** — from live animal at the farm gate all the way to customer delivery and government recall readiness.

The bin system is essentially **Stage 9 (By-Products)** of the full picture, built well, but the other 10 stages are currently missing.

---

## ✅ What Is Built Today (Honest Assessment)

### Infrastructure — Strong Foundation
- ✅ Monorepo (Turborepo + pnpm workspaces)
- ✅ Fastify + tRPC API with proper auth middleware
- ✅ Prisma + PostgreSQL
- ✅ Supabase JWT auth with role-based access (`ADMIN`, `OPS_MANAGER`, `DRIVER`, `WORKER`)
- ✅ Facility-scoped multi-tenancy
- ✅ Serializable transactions on all state changes
- ✅ Append-only `EventLog` as immutable audit trail
- ✅ Cardano blockchain anchoring (CIP-25 NFT, Merkle tree)
- ✅ Cursor-based pagination on all list endpoints
- ✅ Soft delete on facilities
- ✅ Vite + React + tRPC frontend

### Stage 9 — By-Products & Waste ✅ BUILT (Core Feature)
The bin lifecycle (IDLE → ACTIVE → IN_TRANSIT → COMPLETED) maps directly to by-product bin tracking:
- ✅ `BinType` model (organ type, DK hours, urgency, prefix)
- ✅ `Bin` model with QR code, status, facility
- ✅ `BinCycle` with deadline, pickup, delivery, compliance result
- ✅ `EventLog` per cycle transition
- ✅ Tablet scan flow (Scan 1 — facility worker)
- ✅ Driver app (Scan 2 pickup + Scan 3 deliver)
- ✅ Ops dashboard (KPIs, priority queue, overdue list, by-urgency breakdown)
- ✅ Blockchain anchoring of completed cycles
- ✅ Dynamic bin creation from Master QR Code

### Stage 1 — Animal Receiving ⚠️ PARTIALLY BUILT
- ✅ `AnimalRegistration` model (animal type, breed, age, weight, owner name, health condition)
- ✅ Voice-to-text intake via AssemblyAI + Claude extraction
- ✅ `FarmerRegistrationPage` + `VoiceRecorder` component
- ❌ No `Farm` / `Supplier` model — no Farm ID, no address, no farm relationship
- ❌ `AnimalRegistration` is **not linked** to any `LotBatch`, `Facility`, or `Inspector`
- ❌ No ante-mortem inspection record
- ❌ No live weight as a numeric field (stored as freeform String)
- ❌ No lot/batch created from this stage

---

## ❌ What Is Completely Missing (By Stage)

### Stage 2 — Slaughter & Stunning ❌ NOT BUILT
- No `SlaughterRecord` model
- No stunning method tracking
- No bleed-out time recording
- No evisceration log
- No link between animal and carcass

### Stage 3 — Post-Mortem Inspection ❌ NOT BUILT
- No `CarcassInspection` model
- No pass/retain/condemn decision per carcass
- No organ inspection records
- No carcass stamp / official mark tracking
- No `INSPECTOR` user role (enum missing this value)

### Stage 4 — Carcass Processing & Splitting ❌ NOT BUILT
- No `Carcass` model
- No Hot Carcass Weight (HCW) tracking
- No beef grading (A / AA / AAA / Prime)
- No HACCP Critical Control Point records
- No pH / temperature check logging
- No carcass barcode assignment flow

### Stage 5 — Chilling & Aging ❌ NOT BUILT
- No cooler / cold storage model
- No temperature log (time-series readings)
- No Cold Carcass Weight (CCW) tracking
- No yield/shrink calculation
- No aging duration tracking

### Stage 6 — Fabrication / Cutting ❌ NOT BUILT
- No `PrimalCut`, `SubPrimalCut` models
- No cut sheet tracking per species
- No bone-in vs boneless classification
- No trim weight by grade

### Stage 7 — Further Processing ❌ NOT BUILT
- No `ProcessedProduct` model
- No grinding / comminuting records
- No packaging format tracking
- No weight per package/case
- No use-by / best-before date management
- No allergen declarations

### Stage 8 — Inventory & Valuation ❌ NOT BUILT
- No `ProductSKU` or inventory model
- No cost per kg / unit tracking
- No yield loss accounting
- No FIFO / FEFO management
- No cold storage location assignment for finished product

### Stage 10 — Sales, Orders & Dispatch ❌ NOT BUILT
- No `Customer` / `Buyer` model
- No `SalesOrder` model
- No pick & pack confirmation flow
- No carrier / delivery route assignment
- No Bill of Lading generation

### Stage 11 — Compliance & Audit ⚠️ PARTIALLY BUILT
- ✅ `EventLog` — immutable audit trail for bin events
- ✅ Blockchain anchoring — tamper-evident compliance proof
- ❌ No HACCP CCP log table (deviations, corrective actions)
- ❌ No cleaning & sanitation records (SSOP)
- ❌ No recall engine (forward + backward lot trace)
- ❌ No `INSPECTOR` role or inspector sign-off workflow

---

## 🏗️ Schema Gaps (Prisma)

| Missing Model | Needed For |
|---|---|
| `Farm` / `Supplier` | Stage 1 — Farm ID, address, contact |
| `LotBatch` | Stages 1–11 — master traceability key |
| `Animal` | Stages 1–2 — link farm to carcass |
| `SlaughterRecord` | Stage 2 |
| `Carcass` | Stages 2–8 |
| `CarcassInspection` | Stage 3 |
| `ColdStorage` / `Cooler` | Stage 5 |
| `TemperatureLog` | Stages 4, 5, 10 |
| `HaccpRecord` | Stages 3, 4, 5, 11 |
| `PrimalCut` | Stage 6 |
| `ProductSKU` | Stages 6, 7, 8, 10 |
| `PackagedProduct` | Stage 7 |
| `InventoryItem` | Stage 8 |
| `Customer` | Stage 10 |
| `SalesOrder` / `OrderLine` | Stage 10 |
| `DispatchRecord` | Stage 10 |
| `SanitationLog` | Stage 11 |
| `RecallEvent` | Stage 11 |

> **Current schema: 8 models. Full system needs: ~26 models.**

---

## 🔌 API Gaps (tRPC Routers)

| Missing Router | Key Procedures Needed |
|---|---|
| `lotBatch` | `create`, `getById`, `traceForward`, `traceBackward` |
| `farm` | `create`, `list`, `getById`, `update` |
| `animal` | `register`, `linkToLot`, `getById`, `list` |
| `slaughter` | `record`, `getByAnimal` |
| `carcass` | `create`, `grade`, `weigh`, `list`, `getById` |
| `inspection` | `passPostMortem`, `retain`, `condemn`, `getByAnimal` |
| `cooler` | `assign`, `logTemperature`, `recordCCW` |
| `haccp` | `logCCP`, `recordDeviation`, `recordCorrectiveAction` |
| `fabrication` | `createCutSheet`, `recordPrimalCut`, `recordTrim` |
| `processing` | `recordPackaging`, `assignUseBy`, `declareAllergens` |
| `inventory` | `list`, `adjustStock`, `fifoAllocate` |
| `sales` | `createOrder`, `fulfillOrder`, `generateBOL` |
| `recall` | `traceForward`, `traceBackward`, `initiateRecall` |
| `compliance` | `logSanitation`, `logStaffTraining`, `getAuditTrail` |

> **Current routers: 6. Full system needs: ~20 routers.**

---

## 🖥️ UI / Frontend Gaps

| Missing Page / Feature | For Stage |
|---|---|
| Farm / Supplier management page | 1 |
| Lot/Batch creation + label print | 1 |
| Animal intake form (structured) | 1 |
| Slaughter recording form (per animal) | 2 |
| Inspector portal / tablet view | 3, 11 |
| Post-mortem decision UI (pass/retain/condemn) | 3 |
| Carcass grading & HCW entry | 4 |
| HACCP CCP log entry form | 4, 5, 11 |
| Cooler management + temperature chart | 5 |
| CCW recording + yield/shrink display | 5 |
| Fabrication / cut sheet input UI | 6 |
| Packaging & further processing form | 7 |
| Inventory management page (FIFO view) | 8 |
| By-product destination entry (extend existing) | 9 |
| Customer / Buyer management | 10 |
| Order management & fulfillment | 10 |
| Bill of Lading generator | 10 |
| Lot traceability / recall lookup | 11 |
| Compliance audit log viewer | 11 |

---

## 🗺️ Proposed Implementation Roadmap

### Phase 1 — Core Traceability Spine *(Foundation — do this first)*
> Without this, nothing else links together correctly.

1. `LotBatch` model + router (`create`, `getById`, `close`)
2. `Farm` / `Supplier` model + router
3. Extend `AnimalRegistration` → link to `Farm`, `LotBatch`, make `liveWeight` a `Float`
4. Add `INSPECTOR` to `UserRole` enum + migration
5. Lot/Batch creation UI on the intake tablet
6. Auto-generate lot numbers (format: `LOT-YYYY-MMDD-XXXX`)

**Outcome:** Every animal is traceable to a farm and a lot from day one.

---

### Phase 2 — Slaughter & Inspection Pipeline *(Regulatory Core)*
> Most compliance-critical stage. Needed for CFIA/OMAFRA readiness.

1. `Animal` model (linked to Farm + LotBatch)
2. `SlaughterRecord` model (stunning method, bleed time, operator)
3. `Carcass` model (linked to Animal, Lot, HCW, grade)
4. `CarcassInspection` model (inspector, decision, organ results, stamp)
5. `HaccpRecord` model (stage, CCP type, measured value, pass/fail)
6. Inspector tablet UI — post-mortem decision flow
7. Slaughter operator recording UI
8. Link `AnimalRegistration` → `Animal` → `Carcass` → `CarcassInspection`

**Outcome:** Every carcass has a documented inspection decision. Passed vs condemned is on record.

---

### Phase 3 — Processing, Inventory & Cold Chain *(Operations Core)*
> This is where the physical product is created and tracked.

1. `ColdStorage` model (cooler, location, capacity)
2. `TemperatureLog` model (time-series, linked to cooler + lot)
3. `PrimalCut` model (cut type, weight, bone-in/boneless, carcass FK)
4. `ProductSKU` model (species, cut, grade, weight class, cost/kg)
5. `PackagedProduct` model (SKU, weight, use-by date, allergen flags, lot FK)
6. `InventoryItem` model (current stock, location, FIFO date)
7. Cooler management + temperature log UI
8. Fabrication / cut sheet entry UI
9. Packaging UI with use-by date + allergen form
10. Inventory dashboard with FIFO warnings

**Outcome:** Full product lifecycle from carcass to shelf-ready packaged unit, traceable to lot.

---

### Phase 4 — Sales, Dispatch & Recall Engine *(Commercial + Compliance)*
> Closes the loop from farm to customer. Enables government recall in seconds.

1. `Customer` model + router
2. `SalesOrder` + `OrderLine` models + router
3. `DispatchRecord` model (carrier, temp at dispatch, BOL)
4. Recall engine — `traceForward(lotId)` → all customers; `traceBackward(productId)` → farm + animal
5. `SanitationLog` model (SSOP, facility, operator)
6. Compliance audit timeline page (per-lot full history)
7. Customer management + order UI
8. Bill of Lading PDF generator
9. Recall lookup page (enter lot → full trace report)

**Outcome:** Stage 10 + 11 complete. Bi-directional lot trace. Government recall-ready in seconds.

---

## 📌 Current Status Summary

| Stage | Status | % Done |
|---|---|---|
| 1 — Animal Receiving | ⚠️ Partial | ~30% |
| 2 — Slaughter & Stunning | ❌ Missing | 0% |
| 3 — Post-Mortem Inspection | ❌ Missing | 0% |
| 4 — Carcass Processing | ❌ Missing | 0% |
| 5 — Chilling & Aging | ❌ Missing | 0% |
| 6 — Fabrication / Cutting | ❌ Missing | 0% |
| 7 — Further Processing | ❌ Missing | 0% |
| 8 — Inventory & Valuation | ❌ Missing | 0% |
| 9 — By-Products & Waste | ✅ Built | ~90% |
| 10 — Sales & Dispatch | ❌ Missing | 0% |
| 11 — Compliance & Audit | ⚠️ Partial | ~20% |
| **Infrastructure & Platform** | ✅ Solid | ~85% |

> **Overall system completeness: ~15%**
> The foundation (auth, database, transactions, real-time, blockchain) is production-quality.
> The domain coverage (stages 1–8, 10–11) is the gap to close.
