# Bin Spoilage Tracking System
## Complete System Specification & Implementation Plan

**Version:** 1.0  
**Date:** February 9, 2026  
**Status:** Draft

---

# Part 1: System Overview

## 1.1 High-Level Goal

An internal operational tracking system for animal by-product bins across 5 facilities. The system tracks organ-specific spoilage (decay/DK times) and provides transparent, blockchain-verified records of all bin operations.

## 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| Simplicity | Max 5 seconds per interaction |
| Reliability | Works in harsh industrial environments |
| Transparency | All operations verifiable on Cardano blockchain |
| Traceability | Complete chain of custody for every bin |

---

# Part 2: Organ Types & Decay Times

## 2.1 Organ Categories

| Organ Type | DK Time | Urgency | Bin Prefix |
|------------|---------|---------|------------|
| Heart | 4 hours | 🔴 Critical | `BIN-HEART-` |
| Liver | 6 hours | 🔴 Critical | `BIN-LIVER-` |
| Kidneys | 12 hours | 🟡 Medium | `BIN-KIDNEY-` |
| Skin | 24 hours | 🟢 Standard | `BIN-SKIN-` |
| Bones | 48 hours | 🟢 Low | `BIN-BONES-` |
| Fat | 24 hours | 🟢 Standard | `BIN-FAT-` |

## 2.2 DK Time Rules

- Clock starts on **first scan** (BIN STARTED)
- Clock **never resets** during active cycle
- Deadline = `start_time + dk_hours`
- Material added later inherits existing deadline (intentional simplification)

---

# Part 3: System Architecture

## 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FACILITIES (5)                          │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│  Facility A │  Facility B │  Facility C │  Facility D │ Fac. E  │
│   Tablet    │   Tablet    │   Tablet    │   Tablet    │ Tablet  │
│  (Station)  │  (Station)  │  (Station)  │  (Station)  │(Station)│
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       └─────────────┴──────┬──────┴─────────────┴───────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │     Backend     │
                   │   (REST API)    │
                   └────────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │ Database │  │   Ops    │  │   Cardano    │
       │(Postgres)│  │Dashboard │  │  Anchoring   │
       └──────────┘  └──────────┘  └──────────────┘
```

## 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Facility Tablet | QR scanning, BIN STARTED events |
| Driver App | PICKED UP and DELIVERED events |
| Backend API | Event processing, state management |
| Database | Persistent storage, event log |
| Ops Dashboard | Priority view, pickup planning, manual actions |
| Anchoring Service | Daily NFT minting on Cardano |

---

# Part 4: Bin Lifecycle (State Machine)

## 4.1 States

```
     SCAN 1                    SCAN 2                    SCAN 3
   (Facility)                 (Pickup)                 (Delivery)
       │                         │                         │
       ▼                         ▼                         ▼
   ┌───────┐    DK Clock    ┌─────────┐               ┌───────────┐
   │ IDLE  │ ──────────────▶│ ACTIVE  │ ─────────────▶│ IN_TRANSIT│ ──────▶ DELIVERED
   └───────┘   Started      └─────────┘   Picked Up   └───────────┘   Arrived
       ▲                                                                   │
       │                                                                   │
       └───────────────────────────────────────────────────────────────────┘
                              Cycle Complete → IDLE
```

## 4.2 State Transitions

| From | To | Trigger | Clock |
|------|----|---------|-------|
| IDLE | ACTIVE | Scan 1 + "BIN STARTED" | ⏱️ STARTED |
| ACTIVE | IN_TRANSIT | Scan 2 + "PICKED UP" | ⏱️ Running |
| IN_TRANSIT | DELIVERED | Scan 3 + "DELIVERED" | ⏱️ STOPPED |
| DELIVERED | IDLE | Automatic reset | ⏱️ Reset |

## 4.3 Re-Scan Behavior

| Current State | Action | Result |
|---------------|--------|--------|
| ACTIVE | Scan + "BIN STARTED" | Shows "Already started at [time]" - no change |
| IN_TRANSIT | Scan + "PICKED UP" | Shows "Already picked up" - no change |

---

# Part 5: Complete Interaction Flow

## 5.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE SYSTEM FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

   FACILITY                    TRANSPORT                   DESTINATION
   (Processing)                (Driver)                    (Rendering Plant)
        │                          │                             │
        ▼                          │                             │
   ┌─────────┐                     │                             │
   │ HEART   │ → 4hr DK            │                             │
   │ LIVER   │ → 6hr DK            │                             │
   │ KIDNEY  │ → 12hr DK           │                             │
   │ SKIN    │ → 24hr DK           │                             │
   │ BONES   │ → 48hr DK           │                             │
   │ FAT     │ → 24hr DK           │                             │
   └────┬────┘                     │                             │
        │                          │                             │
        ▼                          │                             │
   SCAN 1: BIN STARTED             │                             │
   (Tablet at Facility)            │                             │
        │                          │                             │
        │  Event logged:           │                             │
        │  - bin_id                │                             │
        │  - organ_type            │                             │
        │  - dk_hours              │                             │
        │  - start_time            │                             │
        │  - deadline              │                             │
        │  - facility_id           │                             │
        │                          │                             │
        └──────────────────────────┼─────────────────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │    OPS DASHBOARD   │
                         │                    │
                         │  Priority Queue:   │
                         │  1. Heart (01:00:00)│
                         │  2. Liver (02:00:00)│
                         │  3. Kidney(08:00:00)│
                         │  4. Skin (20:00:00) │
                         └─────────┬─────────┘
                                   │
                                   │ Manual Dispatch
                                   ▼
                          SCAN 2: PICKED UP
                          (Driver's Phone)
                                   │
                                   │  Event logged:
                                   │  - pickup_time
                                   │  - driver_id
                                   │  - vehicle_id
                                   │  - GPS location
                                   │
                          ┌────────▼────────┐
                          │    Transit      │
                          └────────┬────────┘
                                   │
                          SCAN 3: DELIVERED
                          (At Destination)
                                   │
                                   │  Event logged:
                                   │  - delivery_time
                                   │  - GPS location
                                   │  - compliance_status
                                   │
                         ┌─────────▼───────────┐
                         │   CYCLE COMPLETE    │
                         │  Added to daily     │
                         │  batch for NFT      │
                         └─────────────────────┘
```

## 5.2 Example Walkthrough: Heart Bin

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BIN-HEART-007 @ Chicago Facility                                             │
│ DK Time: 4 hours                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 08:00 AM   SCAN 1 (Facility Tablet)                                          │
│    │       ├─ Worker scans QR: BIN-HEART-007                                 │
│    │       ├─ Taps: "BIN STARTED"                                            │
│    │       └─ DK Clock: 4 hours remaining                                    │
│    │           └─ Deadline: 12:00 PM                                         │
│    │                                                                         │
│    ▼       [ACTIVE - Clock Running]                                          │
│                                                                              │
│ 10:30 AM   SCAN 2 (Driver at Pickup)                                         │
│    │       ├─ Driver scans QR: BIN-HEART-007                                 │
│    │       ├─ App shows: "2.5 hours used, 1.5 hours remaining"               │
│    │       └─ Confirms: "PICKED UP"                                          │
│    │                                                                         │
│    ▼       [IN_TRANSIT - Clock Still Running]                                │
│                                                                              │
│ 11:15 AM   SCAN 3 (At Delivery Point)                                        │
│    │       ├─ Driver scans QR: BIN-HEART-007                                 │
│    │       ├─ App shows: "3.25 hours used, 0.75 hours remaining"             │
│    │       └─ Confirms: "DELIVERED"                                          │
│    │                                                                         │
│    ▼       [DELIVERED - Cycle Complete ✅]                                   │
│                                                                              │
│            Compliance: ✅ ON TIME (45 minutes before deadline)               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# Part 6: User Interfaces

## 6.1 Facility Tablet UI

```
┌─────────────────────────────────────────────┐
│          CHICAGO PROCESSING                 │
│          ─────────────────────              │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │     📷 SCAN BIN QR CODE             │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   ─────────────────────────────────────     │
│                                             │
│   Last Scanned: BIN-HEART-007               │
│   Organ: HEART (4hr DK)                     │
│   Status: IDLE                              │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │         🟢 BIN STARTED              │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## 6.2 Ops Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BIN OPERATIONS DASHBOARD                                    [Map] [Table]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filter: [All Facilities ▼] [All Organs ▼] [Active Only ☑]                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Countdown │ Bin ID        │ Organ  │ Facility │ Started  │ Deadline │     ││
│  ├───────────┼───────────────┼────────┼──────────┼──────────┼──────────┼─────┤│
│  │ -02:00:00 │ BIN-HEART-003 │ Heart  │ Miami    │ 6:00 AM  │ 10:00 AM │     ││
│  │  00:30:00 │ BIN-LIVER-012 │ Liver  │ Atlanta  │ 5:00 AM  │ 11:00 AM │     ││
│  │  01:30:00 │ BIN-HEART-007 │ Heart  │ Chicago  │ 8:00 AM  │ 12:00 PM │     ││
│  │  07:30:00 │ BIN-KIDNEY-005│ Kidney │ Denver   │ 6:00 AM  │ 6:00 PM  │     ││
│  │  21:00:00 │ BIN-SKIN-008  │ Skin   │ Dallas   │ 8:00 AM  │ 8:00 AM+ │     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  Selected: BIN-HEART-003                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Actions:  [Mark Picked Up]  [Mark Delivered]  [View History]            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.3 Driver App (Mobile)

```
┌───────────────────────────────┐
│        DRIVER APP             │
├───────────────────────────────┤
│                               │
│   Driver: John D.             │
│   Vehicle: TRUCK-003          │
│                               │
│   ─────────────────────────   │
│                               │
│   [📷 Scan Bin QR]            │
│                               │
│   ─────────────────────────   │
│                               │
│   Scanned: BIN-HEART-007      │
│   Organ: Heart (4hr DK)       │
│   Status: ACTIVE              │
│   Time Left: 1.5 hours        │
│                               │
│   ┌───────────────────────┐   │
│   │                       │   │
│   │    📦 PICKED UP       │   │
│   │                       │   │
│   └───────────────────────┘   │
│                               │
│   ┌───────────────────────┐   │
│   │    ✅ DELIVERED       │   │
│   └───────────────────────┘   │
│                               │
└───────────────────────────────┘
```

---

# Part 7: Data Model

## 7.1 Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Facility   │     │   Station    │     │   BinType    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │◄────│ facility_id  │     │ id (PK)      │
│ name         │     │ id (PK)      │     │ organ_type   │
│ location     │     │ token        │     │ dk_hours     │
│ address      │     │ type         │     │ urgency      │
│ lat/lng      │     └──────────────┘     └──────┬───────┘
└──────────────┘                                  │
       │                                          │
       │                                          │
       ▼                                          ▼
┌──────────────────────────────────────────────────────┐
│                        Bin                           │
├──────────────────────────────────────────────────────┤
│ id (PK)                                              │
│ qr_code (unique)                                     │
│ bin_type_id (FK)                                     │
│ current_facility_id (FK)                             │
│ status: idle | active | in_transit | delivered      │
│ current_cycle_id (FK, nullable)                      │
└──────────────────────────────────────────────────────┘
       │
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                     BinCycle                         │
├──────────────────────────────────────────────────────┤
│ id (PK)                                              │
│ bin_id (FK)                                          │
│ facility_id (FK)                                     │
│ destination_id (FK, nullable)                        │
│ status: active | in_transit | completed | overdue    │
│ started_at (timestamp)                               │
│ deadline (timestamp)                                 │
│ picked_up_at (timestamp, nullable)                   │
│ delivered_at (timestamp, nullable)                   │
│ driver_id (FK, nullable)                             │
│ vehicle_id (nullable)                                │
│ compliance_status: on_time | late | overdue          │
│ anchored: boolean                                    │
│ anchor_tx_hash (nullable)                            │
└──────────────────────────────────────────────────────┘
       │
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                     EventLog                         │
├──────────────────────────────────────────────────────┤
│ id (PK)                                              │
│ cycle_id (FK)                                        │
│ event_type: BIN_STARTED | PICKED_UP | DELIVERED      │
│ timestamp                                            │
│ station_id (FK, nullable)                            │
│ driver_id (FK, nullable)                             │
│ location_lat (nullable)                              │
│ location_lng (nullable)                              │
│ metadata (JSONB)                                     │
└──────────────────────────────────────────────────────┘
```

## 7.2 Cycle Record (JSON Schema)

```json
{
  "cycle_id": "cycle-20260209-007",
  "bin_id": "BIN-HEART-007",
  "bin_type": "heart",
  "dk_hours": 4,
  
  "facility": {
    "id": "chicago",
    "name": "Chicago Processing"
  },
  
  "destination": {
    "id": "rendering-plant-01",
    "name": "Midwest Rendering"
  },
  
  "timeline": {
    "started_at": "2026-02-09T08:00:00Z",
    "deadline": "2026-02-09T12:00:00Z",
    "picked_up_at": "2026-02-09T10:30:00Z",
    "delivered_at": "2026-02-09T11:15:00Z"
  },
  
  "events": [
    {
      "type": "BIN_STARTED",
      "timestamp": "2026-02-09T08:00:00Z",
      "station_id": "chicago-tablet-01",
      "location": { "lat": 41.8781, "lng": -87.6298 }
    },
    {
      "type": "PICKED_UP",
      "timestamp": "2026-02-09T10:30:00Z",
      "driver_id": "driver-042",
      "vehicle_id": "truck-003",
      "location": { "lat": 41.8781, "lng": -87.6298 }
    },
    {
      "type": "DELIVERED",
      "timestamp": "2026-02-09T11:15:00Z",
      "driver_id": "driver-042",
      "location": { "lat": 41.9123, "lng": -87.7456 }
    }
  ],
  
  "compliance": {
    "on_time": true,
    "total_duration_hours": 3.25,
    "remaining_hours": 0.75,
    "status": "compliant"
  }
}
```

---

# Part 8: Cardano Blockchain Integration

## 8.1 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL LAYER (Off-Chain)                    │
│                                                                          │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│   │ Tablets  │────▶│ Backend  │────▶│ Database │────▶│Dashboard │       │
│   │ & Apps   │     │   API    │     │(Postgres)│     │          │       │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘       │
│                           │                                              │
│                           │ Completed cycles (end of day)                │
│                           ▼                                              │
│                    ┌─────────────┐                                       │
│                    │  Anchoring  │                                       │
│                    │   Service   │                                       │
│                    └──────┬──────┘                                       │
└───────────────────────────┼──────────────────────────────────────────────┘
                            │
                            │ Daily NFT + Merkle root
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       CARDANO BLOCKCHAIN (On-Chain)                      │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    Daily Operations NFT                           │  │
│   │                                                                   │  │
│   │  Policy ID: policy_abc123...                                      │  │
│   │  Asset: BIN_OPS_20260209                                          │  │
│   │                                                                   │  │
│   │  Metadata:                                                        │  │
│   │  - total_cycles: 47                                               │  │
│   │  - compliance_rate: 95.7%                                         │  │
│   │  - merkle_root: 3a7f8b2c...                                       │  │
│   │  - by_organ: {...}                                                │  │
│   │  - by_facility: {...}                                             │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 8.2 Daily NFT Metadata Structure

```json
{
  "721": {
    "<policy_id>": {
      "BIN_OPS_20260209": {
        "name": "Daily Bin Operations - Feb 9, 2026",
        "date": "2026-02-09",
        "summary": {
          "total_cycles": 47,
          "on_time": 45,
          "late": 2,
          "compliance_rate": "95.7%"
        },
        "by_organ": {
          "heart": { "count": 8, "on_time": 8 },
          "liver": { "count": 10, "on_time": 9 },
          "kidney": { "count": 12, "on_time": 12 },
          "skin": { "count": 10, "on_time": 10 },
          "bones": { "count": 5, "on_time": 4 },
          "fat": { "count": 2, "on_time": 2 }
        },
        "by_facility": {
          "chicago": { "count": 15, "on_time": 15 },
          "denver": { "count": 12, "on_time": 11 },
          "atlanta": { "count": 10, "on_time": 10 },
          "miami": { "count": 5, "on_time": 4 },
          "dallas": { "count": 5, "on_time": 5 }
        },
        "merkle_root": "3a7f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c...",
        "verification_url": "https://verify.yourcompany.com/2026-02-09"
      }
    }
  }
}
```

## 8.3 Merkle Tree Construction

```
                            Merkle Root
                         (Stored on-chain)
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
         Hash(H1+H2)                         Hash(H3+H4)
              │                                   │
       ┌──────┴──────┐                     ┌──────┴──────┐
       │             │                     │             │
      H1            H2                    H3            H4
   (Cycle 1)    (Cycle 2)             (Cycle 3)    (Cycle 4)
       │             │                     │             │
  SHA256(        SHA256(              SHA256(       SHA256(
   JSON)          JSON)                JSON)         JSON)
```

## 8.4 Verification Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VERIFICATION PORTAL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ VERIFY BY DATE ───────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  Date: [February 9, 2026 ▼]  [Verify]                                   │ │
│  │                                                                         │ │
│  │  ✅ NFT Found: BIN_OPS_20260209                                         │ │
│  │  TX: a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5...                               │ │
│  │  [View on CardanoScan]                                                  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ VERIFY SPECIFIC CYCLE ─────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  Cycle ID: [cycle-20260209-007] [Verify]                                │ │
│  │                                                                         │ │
│  │  ✅ VERIFIED                                                            │ │
│  │                                                                         │ │
│  │  Bin: BIN-HEART-007                                                     │ │
│  │  Organ: Heart (4-hour DK)                                               │ │
│  │  Facility: Chicago Processing                                           │ │
│  │                                                                         │ │
│  │  Timeline:                                                              │ │
│  │  ├─ Started:   08:00 AM                                                 │ │
│  │  ├─ Deadline:  12:00 PM                                                 │ │
│  │  ├─ Picked Up: 10:30 AM                                                 │ │
│  │  └─ Delivered: 11:15 AM ✅ (45min before deadline)                      │ │
│  │                                                                         │ │
│  │  Blockchain Proof:                                                      │ │
│  │  ├─ Part of: BIN_OPS_20260209                                           │ │
│  │  ├─ Merkle Proof: [Show Details]                                        │ │
│  │  └─ Position: 7 of 47 cycles                                            │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.5 Blockchain Benefits

| Benefit | Description |
|---------|-------------|
| **Immutability** | Once anchored, records cannot be altered |
| **Third-Party Verification** | Auditors verify without database access |
| **Customer Trust** | Independent verification of pickups |
| **Regulatory Defense** | Mathematical proof of compliance |
| **ESG Credibility** | Sustainability claims verifiable |
| **Low Cost** | ~$0.30/day for daily NFT |

---

# Part 9: Advanced Features (Future)

## 9.1 Operational Intelligence

| Feature | Description |
|---------|-------------|
| Predictive Fill Rates | ML predicts when bins will be full |
| Dynamic DK Windows | Adjust based on temperature/season |
| Anomaly Detection | Flag unusual patterns |
| Facility Benchmarking | Compare utilization across facilities |

## 9.2 Enhanced Tracking

| Feature | Description |
|---------|-------------|
| Weight Integration | IoT scales track bin weight |
| Temperature Sensors | Monitor bin temperature |
| Photo Capture | Visual record on BIN STARTED |
| GPS Tracking | Real-time vehicle location |

## 9.3 Automation

| Feature | Description |
|---------|-------------|
| Smart Notifications | Alert on warning/urgent thresholds |
| Route Optimization | Suggest optimal pickup sequences |
| Capacity Planning | Forecast bin needs |

---

# Part 10: Implementation Plan

## 10.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPLEMENTATION PHASES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Core MVP                                          (Weeks 1-4)     │
│  ├─ Database schema & API                                                    │
│  ├─ Facility tablet UI                                                       │
│  ├─ Ops dashboard (table view)                                               │
│  └─ Basic cycle management                                                   │
│                                                                              │
│  Phase 2: Multi-Stage Tracking                              (Weeks 5-6)     │
│  ├─ Driver app (pickup/delivery)                                             │
│  ├─ IN_TRANSIT state                                                         │
│  └─ Complete event logging                                                   │
│                                                                              │
│  Phase 3: Cardano Integration                               (Weeks 7-8)     │
│  ├─ Anchoring service                                                        │
│  ├─ Daily NFT minting                                                        │
│  ├─ Verification portal                                                      │
│  └─ Merkle tree implementation                                               │
│                                                                              │
│  Phase 4: Polish & Deploy                                   (Weeks 9-10)    │
│  ├─ Map view in dashboard                                                    │
│  ├─ Testing across all facilities                                            │
│  ├─ Performance optimization                                                 │
│  └─ Production deployment                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 Phase 1: Core MVP (Weeks 1-4)

### Week 1: Project Setup & Database

**Tasks:**
- [ ] Initialize project (Next.js + Node.js backend)
- [ ] Set up PostgreSQL database
- [ ] Implement Prisma schema for all entities
- [ ] Run initial migrations
- [ ] Set up development environment

**Deliverables:**
- Working database with all tables
- Basic API health endpoint
- Development environment ready

### Week 2: Core API Endpoints

**Tasks:**
- [ ] `POST /api/bins/start` - Start a bin cycle
- [ ] `GET /api/bins/:id` - Get bin status
- [ ] `GET /api/cycles/active` - List all active cycles
- [ ] `POST /api/cycles/:id/pickup` - Mark as picked up
- [ ] `POST /api/cycles/:id/deliver` - Mark as delivered
- [ ] Station authentication (token-based)
- [ ] Input validation & error handling

**Deliverables:**
- All core API endpoints working
- Postman/Insomnia collection for testing

### Week 3: Facility Tablet UI

**Tasks:**
- [ ] QR scanner component
- [ ] Bin status display
- [ ] "BIN STARTED" button with feedback
- [ ] "Already started" state handling
- [ ] Station identification (URL token)
- [ ] Offline handling (queue events)
- [ ] Large touch targets for gloves

**Deliverables:**
- Working tablet interface
- Tested on actual tablet hardware

### Week 4: Ops Dashboard (Table View)

**Tasks:**
- [ ] Priority-sorted bin table
- [ ] Real-time updates (polling or WebSocket)
- [ ] Countdown timer display (HH:MM:SS)
- [ ] Filter by facility/organ type
- [ ] Manual "Mark Picked Up" action
- [ ] Manual "Mark Delivered" action
- [ ] Basic authentication for ops team

**Deliverables:**
- Functional ops dashboard
- All CRUD operations working

## 10.3 Phase 2: Multi-Stage Tracking (Weeks 5-6)

### Week 5: Driver App

**Tasks:**
- [ ] Mobile-responsive web app
- [ ] QR scanner for bins
- [ ] Current bin status display
- [ ] "PICKED UP" confirmation flow
- [ ] "DELIVERED" confirmation flow
- [ ] GPS location capture
- [ ] Driver identification

**Deliverables:**
- Working driver app
- Tested on mobile devices

### Week 6: State Machine & Events

**Tasks:**
- [ ] Full state machine implementation
- [ ] IN_TRANSIT state handling
- [ ] Append-only event log
- [ ] State transition validations
- [ ] Cycle completion logic
- [ ] Automatic bin reset to IDLE

**Deliverables:**
- Complete 3-stage lifecycle working
- Full event history for all cycles

## 10.4 Phase 3: Cardano Integration (Weeks 7-8)

### Week 7: Anchoring Service

**Tasks:**
- [ ] Cardano wallet integration (Blockfrost/Lucid)
- [ ] Merkle tree library implementation
- [ ] Cycle record canonicalization
- [ ] Hash computation for cycles
- [ ] Daily batch aggregation job
- [ ] Merkle root computation

**Deliverables:**
- Merkle tree building working
- Daily batch job scheduled

### Week 8: NFT Minting & Verification

**Tasks:**
- [ ] NFT policy script
- [ ] Daily NFT minting transaction
- [ ] Metadata construction (CIP-25)
- [ ] Verification portal UI
- [ ] Merkle proof verification
- [ ] Link to CardanoScan

**Deliverables:**
- Daily NFTs minting on testnet
- Working verification portal

## 10.5 Phase 4: Polish & Deploy (Weeks 9-10)

### Week 9: Map View & Refinements

**Tasks:**
- [ ] Map component (Leaflet/Mapbox)
- [ ] Facility pins with countdown timers
- [ ] Bin details on pin click
- [ ] Google Maps directions link
- [ ] UI/UX polish across all interfaces
- [ ] Error handling improvements
- [ ] Loading states and feedback

**Deliverables:**
- Complete dashboard with map
- Polished user experience

### Week 10: Testing & Deployment

**Tasks:**
- [ ] End-to-end testing (all user flows)
- [ ] Performance testing (100+ active bins)
- [ ] Load testing for API
- [ ] Cardano mainnet deployment
- [ ] Production infrastructure setup
- [ ] SSL, DNS, domain configuration
- [ ] Tablet deployment at facilities
- [ ] Staff training documentation

**Deliverables:**
- Production system live
- All 5 facilities operational

---

## 10.6 Technology Stack (Recommended)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend (Tablet)** | Next.js + React | PWA support, offline capability |
| **Frontend (Dashboard)** | Next.js + React | Shared codebase |
| **Driver App** | Next.js (mobile web) | No app store needed |
| **Backend API** | Node.js + Express/Fastify | Simple, well-known |
| **Database** | PostgreSQL + Prisma | Reliable, great ORM |
| **Cardano** | Lucid + Blockfrost | Easiest Cardano integration |
| **Hosting** | Vercel + Railway/Render | Easy deployment |
| **Map** | Leaflet + OpenStreetMap | Free, no API limits |

---

## 10.7 API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/bins/:id` | GET | Get bin status |
| `/api/bins/start` | POST | Start bin cycle (Scan 1) |
| `/api/cycles/active` | GET | All active cycles |
| `/api/cycles/:id` | GET | Cycle details |
| `/api/cycles/:id/pickup` | POST | Mark picked up (Scan 2) |
| `/api/cycles/:id/deliver` | POST | Mark delivered (Scan 3) |
| `/api/cycles/:id/events` | GET | Event history |
| `/api/dashboard/priority` | GET | Priority-sorted list |
| `/api/verify/:date` | GET | Verify daily NFT |
| `/api/verify/cycle/:id` | GET | Verify specific cycle |

---

## 10.8 Success Criteria

| Metric | Target |
|--------|--------|
| Scan-to-confirmation time | < 5 seconds |
| System uptime | > 99.5% |
| Daily NFT minting | 100% success |
| Staff adoption | 100% across facilities |
| Compliance visibility | Real-time |

---

# Part 11: Out of Scope (MVP)

- Automated routing / dispatch optimization
- Push notifications
- Weight tracking / yield analytics
- IoT sensor integration
- Advanced permissions / RBAC
- ESG dashboards (future phase)
- On-chain operational logic (smart contracts)
- Proof-of-delivery (photos/signatures)

---

# Part 12: Summary

This system provides:

1. **Simple operations** - Scan → Tap → Done in 5 seconds
2. **Complete traceability** - Every bin has full lifecycle tracking
3. **Organ-specific urgency** - Different DK times for different materials
4. **Transparent records** - Daily NFT proves all operations on Cardano
5. **Verifiable compliance** - Anyone can verify any pickup

The architecture is intentionally simple, reliable, and built for harsh industrial environments while preparing for future blockchain-verified transparency.
