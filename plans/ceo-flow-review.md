# Bin Tracking System — How It Works (End-to-End)

---

## The Complete Flow — A Day in the Life

### Step 1: A Bin Starts Filling at the Facility

It's 8:00 AM at the Chicago processing facility. Ravi, a floor worker wearing heavy gloves in a cold, wet environment, has just started filling a bin with animal by-products. He walks over to the facility's wall-mounted tablet — the only device at this location, always on, no login required.

Ravi picks up the bin and holds its QR code in front of the tablet's camera. The tablet instantly reads the QR and shows the bin's ID — something like "BIN-042". The screen now shows one large green button: **"BIN STARTED"**. Ravi taps it with his gloved hand.

That single tap does something critical behind the scenes: **the spoilage clock starts**. The system records exactly when this bin began its cycle — 8:00 AM — and calculates a pickup deadline based on the configured spoilage window (for example, if the spoilage window is set to 8 hours, the deadline becomes 4:00 PM). The screen briefly confirms "BIN-042 started at 8:00 AM" and then goes back to the scanning screen, ready for the next bin.

The entire interaction took Ravi about 5 seconds. No typing, no login, no selecting options from a dropdown. Just scan and tap.

---

### Step 2: What Happens If Someone Scans the Same Bin Again

At 9:30 AM, Ravi — or another worker — scans BIN-042 again. Maybe it was an accident, maybe they forgot it was already started, maybe they're just curious. It doesn't matter. The tablet shows a clear message: **"This bin was already started at 8:00 AM. The clock is still running."** The spoilage clock does **not** reset. This is a deliberate design decision — we never want an accidental re-scan to restart the countdown, because that would hide how long the material has actually been sitting there. The original start time is locked in until the bin is picked up.

---

### Step 3: The Ops Dashboard — Seeing Everything at a Glance

Meanwhile, Sarah, the operations manager, is sitting at her desk with the ops dashboard open on her laptop. This dashboard shows **every active bin across all five facilities**, sorted by urgency — the bins closest to their spoilage deadline appear at the top.

Right now, Sarah's screen shows something like this: Miami's BIN-017 is **overdue** — it passed its deadline 3 hours ago and shows **-03:00:00**. Atlanta's BIN-033 is **urgent** — only 30 minutes remain, showing **00:30:00**. Chicago's BIN-042 (Ravi's bin) is in **warning** territory — a few hours left, showing **02:15:00**. Denver and Dallas have bins that are fine for now, showing comfortable countdowns like **06:30:00**.

Each row in the table shows the facility name, bin ID, when it was started, what the pickup deadline is, and a **live countdown timer (HH:MM:SS)** showing exactly how much time remains before the spoilage deadline. Overdue bins display negative time (e.g., -03:00:00). Sarah can filter by facility if she wants to focus on one location, or she can see everything at once.

---

### Step 4: The Map View — Planning Pickups Visually

Sarah clicks over to the map tab. Now she sees all five facility locations plotted on a map, with each pin showing the **countdown timer of the most critical bin** at that location. Miami's pin shows **-03:00:00** (overdue), Atlanta's pin shows **00:30:00** (urgent), Chicago shows **02:15:00** (warning), and Denver and Dallas show comfortable times like **06:30:00** (fine).

She can click on any pin to see the bin details for that facility. There's also an option to open directions in Google Maps if she needs to send a driver somewhere. But the map itself does **not** do any automated routing or dispatching — it's purely a visual tool to help Sarah understand where things stand geographically and decide which facility to prioritize. All pickup planning is done manually by Sarah using her own judgment.

---

### Step 5: Marking a Bin as Picked Up

Sarah decides Miami is the top priority. She calls the truck driver and sends him to the Miami facility. Once she gets confirmation that the driver has arrived and picked up BIN-017, Sarah goes back to the dashboard, clicks on BIN-017, and hits **"Mark Picked Up"**. A simple confirmation dialog appears — she confirms, and the system records the pickup time.

At this moment, the bin's cycle is **complete**. The system logs the full cycle — when it started, when the deadline was, and when it was actually picked up. BIN-017 is then automatically reset to **"IDLE"** status, meaning it's ready to be used again at the Miami facility. If Ravi's counterpart in Miami scans it tomorrow morning, a brand-new cycle will begin with a fresh clock.

---

### Step 6: What Gets Recorded (The Data Trail)

Every single action in this flow — the initial scan, the "BIN STARTED" tap, the "PICKED UP" confirmation — is recorded as an **append-only event**. Nothing is ever deleted or edited in the event history. If a mistake is made (say someone accidentally marks a bin as picked up), the correction is recorded as a **new event**, not by editing the old one. This creates a complete, tamper-proof audit trail for every bin cycle, which becomes important later when we add blockchain verification.

---

### The Complete Cycle at a Glance

So the full lifecycle of a single bin goes like this: **IDLE → ACTIVE → PICKED UP → IDLE again**. A bin sits idle until a facility worker scans it and taps "BIN STARTED", which makes it active and starts the spoilage clock. It stays active — with the clock ticking — until the ops manager marks it as picked up on the dashboard. At that point the cycle is complete, the bin goes back to idle, and it's ready for a fresh cycle.

There is no driver app in this version. There is no delivery confirmation. There is no login for facility workers. There is no automated dispatch. This is intentionally minimal — a reliable, simple system that works in harsh conditions with minimal training.

---

### Flow Diagram

```
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║                     BIN TRACKING — COMPLETE FLOW                       ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  FACILITY (Worker - Ravi)                    OPS OFFICE (Manager - Sarah)
  ─────────────────────────                   ────────────────────────────

  ┌─────────────────────┐
  │  Bin is IDLE        │
  │  (not in use)       │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │  Worker scans       │
  │  bin QR code        │
  │  on tablet          │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │  Taps               │
  │  "BIN STARTED"      │─────────────────────────┐
  └─────────┬───────────┘                         │
            │                                     │
            ▼                                     ▼
  ┌─────────────────────┐               ┌─────────────────────────┐
  │  ⏱️ SPOILAGE CLOCK   │               │  Bin appears on         │
  │  STARTS TICKING     │               │  Ops Dashboard          │
  │                     │               │  (sorted by urgency)    │
  │  Deadline = now +   │               │                         │
  │  spoilage hours     │               │  Countdown: HH:MM:SS    │
  └─────────┬───────────┘               │  (negative = overdue)   │
            │                           └────────────┬────────────┘
            │                                        │
                                                     │
            ┌────────────────────────────────────────┘
            │
            ▼
  ┌───────────────────────────────┐
  │  Sarah reviews dashboard     │
  │  and/or map view             │
  │                              │
  │  Decides which bins to       │
  │  pick up first               │
  │  (manual decision)           │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌───────────────────────────────┐
  │  Sarah clicks                │
  │  "MARK PICKED UP"            │
  │  on the dashboard            │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌───────────────────────────────┐
  │  ✅ CYCLE COMPLETE            │
  │                              │
  │  • Pickup time recorded      │
  │  • Full event history saved  │
  │  • Bin resets to IDLE        │
  │  • Ready for next cycle      │
  └──────────────────────────────┘
```
