# Demo feature inventory (trackingbin.netlify.app) → nextphase-app

Crawled from the live demo. Everything below must be present in the rebuild.
Two changes from the demo: **Ops Dashboard merges into one unified Facility Dashboard**, and
**"Guard Scanner" → "Employee Scanner"**.

## Top-level mode switcher
`Floor` · `Butcher Talk` · `Back Office` (segmented control in the top bar).

## Sidebar — FACILITY ZONES
MAIN DASHBOARD, RECEIVING, KILL FLOOR, PROCESSING, WET AGING, VALUE ADD, SHIPPING,
(+ OPS DASHBOARD — now folded into MAIN DASHBOARD as one unified dashboard).

## Routes & screens
| Route | Screen | Key content |
|---|---|---|
| `/app/facility` | **Unified Facility Dashboard** (Daily Workflow + Ops merged) | Workflow progress %, 6 zone status cards (COMPLETE/ACTIVE/IDLE/PENDING), latest activity log, environmental panel; PLUS ops metrics: ACTIVE BINS, OVERDUE, DONE TODAY, COMPLIANCE %, "Post on Blockchain", time filters (All Time / 2 Days / 7 Days / Custom), Refresh |
| `/app/facility/receiving` | Receiving Zone | dock status, expected deliveries, daily intake; active deliveries (trucks: provider, units, dock, status); Zone Actions (Log Incoming Lot, Verify manifest, Update inventory); Zone Environment (ambient temp, humidity) |
| `/app/facility/killfloor` | Kill Floor Zone | throughput/line-speed stats; active stations; zone actions; environment |
| `/app/facility/processing` | Processing Zone | units pending, cut lines, yield; active batches; actions; environment |
| `/app/facility/wetaging` | Wet Aging Zone | cooler capacity %, avg aging time, critical alerts; active racks (lot, cut, age day, units, status); Atmosphere (temp, humidity, CO2); Zone Actions (Move to Value Add, Temp Log Override, Inventory Audit) |
| `/app/facility/valueadd` | Value Add Zone | prep quota %, active staff, prep stations; current projects (Marination Batch, Custom Cuts: units, soak time/station); Zone Actions (Start New Project, Label Printing, Waste Log); system status |
| `/app/facility/shipping` | Shipping Zone | bays, outbound loads, manifests; active shipments; actions; environment |
| `/app/dashboard` | Ops Dashboard | (merged into unified dashboard) All Cycles; ACTIVE BINS, OVERDUE, DONE TODAY, COMPLIANCE 100%; Post on Blockchain; time filters; Refresh |
| `/app/driver` | **Driver Portal** (own minimal layout) | Scan a Bin (Simulate Scan + manual QR entry); Dashboard/Bin tabs; driver identity (name, truck) |
| `/app/bin` | **Facility Scanner** | Scan Bin QR Code, Simulate Scan; bin detail after scan |
| `/app/forms` | **Forms** | list: Daily Bin Form, Est 183 Feeding and Watering Livestock, Equipment Review Form, Customer Complaint Investigation Form, Allergen Checklist, Plant Receiving Record — Meat & Non-Meat; types Multi-Section / Checklist; Manual Builder; Fill Form (multi-section fill flow) |
| `/app/forms/import` | **Create from Photo** | Upload image → AI extracts a structured form |
| `/app/guard` | **Employee Scanner** (was Guard Scanner) | Scan Badge; Handheld scanner / Camera modes; check-in/out |
| `/app/animalregistration` | **Farmer Animal Registration** | fields: Animal Type*, Breed, Age, Weight, Owner Name*, Health Condition; Submit Registration; right panel VOICE RECORDING "Speak all your animal details in one go" → Start Recording (voice-fills form) |
| `/app/employees/register` | **Employee Registration** | new employee form → Register & Generate QR badge |
| `/app/shipments` | **Supplier Shipments** | stats: Total shipments, Total items, Damaged; table SHIPMENT(id)/SUPPLIER/FACILITY/QTY/RECEIVED/CONDITION(badge); Record Shipment; Refresh |
| `/app/shipments/new` | **Record Supplier Shipment** | record inbound shipment form |
| `/app/timesheet` | **Timesheet Dashboard** | Hours by employee + Recent scans; table EMPLOYEE/DEPARTMENT/SESSIONS/HOURS/STATUS; Refresh |

## Cross-cutting
- Persistent **voice / intent bar** ("listening for intent…", Butcher Talk capture) on facility screens.
- Mono uppercase `snake_case` data labels (DOCK_STATUS, ZONE_ENVIRONMENT, etc.).
- Status badges (COMPLETE/ACTIVE/IDLE/PENDING/Good), live-ticking sensor values.
- Blockchain seal action ("Post on Blockchain") + compliance score.

## Reimagined in nextphase-app
Same features/sections, redesigned with the premium marketing aesthetic (brand palette, animated
live dashboards, ticking data, smooth Framer Motion transitions). New route base is `/` (app root)
rather than `/app/...`.
