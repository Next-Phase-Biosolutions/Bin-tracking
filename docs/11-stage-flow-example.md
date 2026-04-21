# The Journey of LOT-2026-0412-0001
## A Complete 11-Stage Walkthrough — Green Pastures Farm, 50 Cattle

---

## Overview

This document walks through the complete lifecycle of a single lot of 50 cattle —
from the moment the truck arrives at the facility to the moment the meat reaches
the customer and gets anchored on the Cardano blockchain.

Every piece of data created along the way is linked by one key: **LOT-2026-0412-0001**

---

## Stage 1 — Animal Receiving & Ante-Mortem

**Who does it:** WORKER at the intake dock tablet + CFIA INSPECTOR

A truck from **Green Pastures Farm** pulls up at 8:00am on April 17, 2026.
A worker opens the app and taps "Create New Lot".

**Worker fills in:**
- Farm: Green Pastures Farm
- Species: BEEF
- Animal Count: 50
- Live Weight: 32,500 kg (total)
- Arrival: 2026-04-17 at 08:00

**System auto-generates lot number:** LOT-2026-0412-0001

The worker then scans each animal's ear tag one by one.
Each scan creates an individual animal record:

- Animal A-1042: breed Angus | live weight 650 kg | health OK
- Animal A-1043: breed Angus | live weight 620 kg | health OK
- ... (50 animals total)

The CFIA INSPECTOR is also present at intake.
They open the Inspector portal and sign off the ante-mortem inspection on each animal.
Any sick animals are flagged and removed from the lot before slaughter.

**What gets recorded in the system:**
- 1 Lot record (LOT-2026-0412-0001)
- 1 Farm record (Green Pastures Farm)
- 50 Animal records, all linked to the lot

---

## Stage 2 — Slaughter & Stunning

**Who does it:** WORKER (kill floor operator)

The worker opens the app, navigates to Stage 2 Slaughter, and selects LOT-2026-0412-0001.

For each animal they record:

**Example — Animal A-1042:**
- Stunning method: Captive Bolt
- Sticking time: 08:45
- Bleed-out duration: 6.5 minutes
- Evisceration completed: 09:10

As organs are removed (liver, heart, kidneys, etc.) they are placed into labelled bins.
The worker scans each bin QR code — those bins are now linked to LOT-2026-0412-0001
and enter the existing by-product tracking system (Stage 9).

**What gets recorded in the system:**
- 50 Slaughter records
- Lot status moves to: SLAUGHTERING
- Organ bins linked to the lot

---

## Stage 3 — Post-Mortem Inspection (HACCP Hard Gate)

**Who does it:** CFIA INSPECTOR only — this stage cannot be skipped

The INSPECTOR opens their tablet and sees a queue of 50 carcasses awaiting decision.
For each carcass they physically examine it and make one of three decisions:

- PASS — carcass moves forward
- RETAIN — held for re-examination
- CONDEMN — destroyed, removed from lot

**Example — Carcass from Animal A-1042:**
- Decision: PASS
- Liver: PASS
- Heart: PASS
- Lungs: PASS
- Kidneys: RETAIN (flagged for re-examination)
- Stamp code: CFIA-2026-0417-048
- Inspector: Officer J. Smith
- Time: 09:45

IMPORTANT: The system enforces this gate. If a worker tries to move any carcass
to Stage 4 without an Inspector decision, the system blocks it and returns an error.
The carcass physically cannot proceed without sign-off.

**Result for this lot:**
- 48 carcasses: PASS
- 1 carcass: RETAIN (held)
- 1 carcass: CONDEMN (destroyed)
- Lot continues forward with 48 carcasses

**What gets recorded in the system:**
- 50 Inspection decision records
- 48 carcasses move to status: PASSED
- HACCP records created for Stage 3

---

## Stage 4 — Carcass Processing & Splitting

**Who does it:** WORKER (grader)

The worker opens Stage 4, scans each carcass barcode, and records:

**Example — Carcass from Animal A-1042:**
- Splitting: HALF
- Hot Carcass Weight (HCW): 385 kg
- Grade: AA
- pH: 5.8 (HACCP Critical Control Point — must be 5.4 to 6.2)
- Temperature: 28°C (HACCP CCP — must drop to 4°C in Stage 5)
- Barcode assigned: CARC-2026-0412-0042

The system checks pH and temperature against HACCP limits.
If any value is outside the acceptable range, the system flags a deviation
and requires a corrective action note before the worker can proceed.

**What gets recorded in the system:**
- 48 Carcass records (HCW, grade, barcode)
- 48 HACCP records for Stage 4 (pH + temperature readings)
- Lot status moves to: INSPECTION complete, entering CHILLING

---

## Stage 5 — Chilling & Aging

**Who does it:** WORKER (cooler room operator)

The worker opens Stage 5, scans the carcass barcode, and assigns it to a cooler.

**Example — Carcass CARC-2026-0412-0042:**
- Assigned to: Cooler A
- Entry temperature: 28°C
- Target temperature: 4°C or below (core)

Over the next 24 to 48 hours, the worker manually logs temperatures every 4 hours:

- 09:00 — 28°C
- 13:00 — 18°C
- 17:00 — 12°C
- 21:00 — 8°C
- 08:00 (next day) — 4°C — TARGET REACHED

Once the target is reached, the worker records the final weights:

- Cold Carcass Weight (CCW): 374 kg (was 385 kg HCW — 2.9% shrink)
- Aging duration: 48 hours

**What gets recorded in the system:**
- Carcass chill record per carcass (CCW, aging duration)
- Temperature log entries (time-stamped readings)
- Lot status moves to: CHILLING

---

## Stage 6 — Fabrication / Cutting

**Who does it:** WORKER (fabrication / cut floor)

The worker opens Stage 6, scans the carcass barcode, and records the cut sheet.

**Example — Carcass CARC-2026-0412-0042 (374 kg CCW, one side):**

| Cut        | Weight | Type      |
|------------|--------|-----------|
| Chuck      | 52 kg  | Bone-in   |
| Rib        | 28 kg  | Boneless  |
| Loin       | 35 kg  | Boneless  |
| Round      | 48 kg  | Bone-in   |
| Brisket    | 18 kg  | Bone-in   |
| Trim       | 12 kg  | Ground beef input |
| Bone       | 40 kg  | Bone meal stream  |
| **Total**  | **233 kg** | |

Every cut is linked back to:
Carcass → Animal A-1042 → LOT-2026-0412-0001 → Green Pastures Farm

The chain is unbroken from farm gate to cut table.

**What gets recorded in the system:**
- Primal cut records per cut (weight, type, carcass link)
- Lot status moves to: FABRICATING

---

## Stage 7 — Further Processing & Packaging

**Who does it:** WORKER (packaging line)

The worker opens Stage 7 and selects the cuts to package.

**Example — Rib cut (28 kg, boneless):**
- Product name: Rib Eye Steak Boneless
- Format: RETAIL
- Packages: 14 packs × 2 kg (vacuum sealed)
- Use-by date: 2026-05-01
- Allergens: None

**Example — Trim from all carcasses combined (approx 576 kg):**
- Product name: Ground Beef 80/20
- Format: WHOLESALE
- Packages: 115 bags × 5 kg
- Use-by date: 2026-04-25
- Allergens: None

**What gets recorded in the system:**
- Packaged product records (linked to primal cut → carcass → lot)
- Use-by date and allergen declarations stored per package
- Lot status moves to: PROCESSING

---

## Stage 8 — Inventory & Valuation

**Who does it:** OPS_MANAGER (inventory dashboard)

Packaged products automatically appear in the Inventory Dashboard.

**LOT-2026-0412-0001 inventory summary (all 48 carcasses):**

| Product                   | Quantity       | Weight    | Status   | Use-by     |
|---------------------------|----------------|-----------|----------|------------|
| Rib Eye Steak Retail 2kg  | 672 packs      | 1,344 kg  | IN STOCK | 2026-05-01 |
| Ground Beef Wholesale 5kg | 115 bags       | 575 kg    | IN STOCK | 2026-04-25 |
| Chuck Bone-in             | (bulk)         | 2,496 kg  | IN STOCK | 2026-04-28 |
| Round Bone-in             | (bulk)         | 2,304 kg  | IN STOCK | 2026-04-28 |
| ... (all cuts)            |                |           |          |            |
| **Total packaged**        |                | ~18,700 kg|          |            |

Cost per kg: $8.40 (automatically allocated from live animal purchase price)

FEFO ordering is enforced: Ground Beef (expires April 25) must be sold
and shipped before Rib Eye Steak (expires May 1).

**What gets recorded in the system:**
- Inventory item records per package
- FEFO date assigned (based on use-by date)
- Cost per kg tracked

---

## Stage 9 — By-Products & Waste Management

**Who does it:** DRIVER + WORKER (existing bin tracking system)

This stage runs in parallel from Stage 2 onwards.
When organs were removed in Stage 2, the worker scanned organ bin QR codes.
Those bins are now tracked through the existing system, and they are all linked
to LOT-2026-0412-0001.

**Bin tracking results for this lot:**
- HEART bin HEART-cycle-0417-x8k → Rendering Facility → DELIVERED ON TIME
- LIVER bin LIVER-cycle-0417-y2p → Rendering Facility → DELIVERED ON TIME
- KIDNEY bin KIDNEY-cycle-0417-z1q → Rendering Facility → DELIVERED LATE

**Carbon Credit MRV calculation:**

| By-Product | Weight  | Emission Factor    | CO2 Offset    |
|------------|---------|--------------------|---------------|
| Offal      | 890 kg  | 0.21 kg CO2e/kg   | 186.9 kg CO2e |
| Blood      | 320 kg  | 0.08 kg CO2e/kg   | 25.6 kg CO2e  |
| Tallow     | 210 kg  | 0.15 kg CO2e/kg   | 31.5 kg CO2e  |
| **Total**  |         |                    | **244 kg CO2e** |

This carbon offset value is stored and included in the final blockchain anchor.

---

## Stage 10 — Sales, Orders & Dispatch

**Who does it:** OPS_MANAGER (sales portal)

A customer order arrives. The OPS_MANAGER opens the Orders section and creates:

**Order ORD-2026-0418-0023:**
- Customer: Metro Supermarket Chain
- Line 1: Rib Eye Steak 2kg × 100 packs (from LOT-2026-0412-0001)
- Line 2: Ground Beef 5kg × 50 bags (from LOT-2026-0412-0001)

The system automatically allocates FEFO — Ground Beef (expires April 25)
is allocated before Rib Eye (expires May 1).

The OPS_MANAGER clicks Dispatch. The system generates a Bill of Lading:

**Bill of Lading BOL-20260418-0023:**
- Carrier: ABC Cold Transport
- Temperature at dispatch: 2°C
- Tracking number: TRK-88221-XP
- Dispatched at: 2026-04-18 at 14:00

**What gets recorded in the system:**
- Sales order and order line records
- Dispatch record with carrier and BOL details
- Inventory items status → SOLD
- Lot status moves to: DISPATCHED

---

## Stage 11 — Compliance & Audit Records

**Who does it:** INSPECTOR or OPS_MANAGER (compliance dashboard)

This is not a separate workflow — it is a live view of everything that happened
across all previous stages, always available, always complete.

**Recall Lookup — type LOT-2026-0412-0001:**

Forward trace (who received product from this lot?):
- Metro Supermarket Chain
- Order: ORD-2026-0418-0023
- Dispatched: 2026-04-18 at 14:00
- Carrier: ABC Cold Transport | Tracking: TRK-88221-XP

Backward trace (where did this lot come from?):
- Farm: Green Pastures Farm
- Animals: 50 cattle (48 processed, 1 retained, 1 condemned)
- Inspector sign-off: Officer J. Smith — 2026-04-17 at 09:45
- All HACCP CCPs: PASSED
- Kill floor operator: Worker #12

**Full compliance audit timeline for LOT-2026-0412-0001:**
- 50 Slaughter records
- 50 Carcass inspection decisions (48 PASS, 1 RETAIN, 1 CONDEMN)
- 192 HACCP CCP records (Stages 3, 4, 5)
- 240 Temperature log entries (Cooler A, every 4 hours over 48 hours)
- 3 By-product bin delivery records
- 1 Sanitation log (post-slaughter clean)
- 1 Dispatch record

If the government calls about a food safety incident, the facility can produce
the complete audit trail for this lot in under 60 seconds.

---

## Blockchain Anchoring — Tamper-Proof Proof

**Who does it:** ADMIN (once lot is fully closed)

Once all orders from this lot are dispatched, the OPS_MANAGER closes the lot.

The system then collects every record linked to LOT-2026-0412-0001:
- 50 slaughter records
- 50 inspection decisions
- 192 HACCP records
- 240 temperature readings
- 3 bin cycle records
- 1 dispatch record

It converts each record into a canonical (unchangeable) JSON format,
then builds a Merkle tree from all the records and computes a single Merkle root hash.

The ADMIN opens the Blockchain Anchor panel, connects their Cardano wallet,
and mints one NFT on the Cardano blockchain with the following metadata:

**Cardano NFT — LOT-2026-0412-0001:**
- Asset name: LOT-2026-0412-0001
- Merkle root: 8f3a2b9c... (unique fingerprint of all records)
- Carbon offset: 244 kg CO2e
- HACCP compliance: 100% pass rate
- Inspector: Officer J. Smith
- Facility: Green Pastures Processing Plant
- Transaction hash: stored permanently on the blockchain

**Why this matters:**

Any ERP system (including inecta) stores HACCP records in a regular database.
A database administrator can edit or delete those records.
There is no way to prove the records were never changed after the fact.

With the Cardano anchor, the Merkle root is permanently written to a public blockchain.
If anyone changes even one temperature reading in the database,
the Merkle root will no longer match the on-chain hash.
This is cryptographic proof that every HACCP record is exactly as it was
at the time the lot was closed — unchanged, untampered.

This is the moat. No ERP on the market offers this.

---

## The Complete Data Chain (Summary)

```
Green Pastures Farm
  └── LOT-2026-0412-0001
        ├── Animal A-1042 (× 50 animals)
        │     ├── Slaughter Record (Stage 2)
        │     ├── Carcass CARC-2026-0412-0042
        │     │     ├── Inspection: PASS — Officer J. Smith (Stage 3)
        │     │     ├── HACCP: pH 5.8, Temp 28°C → 4°C (Stages 4 & 5)
        │     │     ├── Chill Record: CCW 374 kg, 48 hrs (Stage 5)
        │     │     └── Primal Cuts × 7 (Stage 6)
        │     │           └── Packaged Products × 14 (Stage 7)
        │     │                 └── Inventory Items (Stage 8)
        │     │                       └── Order Line → Sales Order
        │     │                             └── Dispatch → Metro Supermarket
        │     └── Organ Bins → Rendering Facility (Stage 9)
        ├── HACCP Records (Stages 3, 4, 5, 11)
        ├── Temperature Logs (240 readings, Stage 5)
        ├── Carbon Credits (244 kg CO2e, Stage 9)
        ├── Sanitation Log (Stage 11)
        └── Cardano Blockchain Anchor
              → Merkle root proves all records are untampered
              → Carbon offset included in NFT metadata
              → Transaction hash: permanent public proof
```

One lot number connects everything from the farm gate to the supermarket shelf
and proves it was never tampered with. That is the system.
