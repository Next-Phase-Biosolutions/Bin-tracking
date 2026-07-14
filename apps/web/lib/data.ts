/**
 * Mock data for the Facility OS demo. This is the ONE place data lives — every screen reads
 * through lib/api.ts, so swapping these in-memory objects for a real backend later touches no UI.
 */

export type ZoneStatus = "complete" | "active" | "idle" | "pending";

export interface ZoneStat {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}
export interface ZoneRow {
  id: string;
  title: string;
  subtitle: string;
  status: { label: string; tone: "complete" | "active" | "idle" | "pending" | "good" | "warn" | "alert" };
  metrics: { label: string; value: string }[];
}
export interface ZoneEnv {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  tone?: "live" | "warn" | "rust";
}
export interface Zone {
  id: string;
  name: string;
  icon: string;
  status: ZoneStatus;
  statusNote: string;
  tagline: string;
  listTitle: string;
  stats: ZoneStat[];
  rows: ZoneRow[];
  actions: string[];
  env: ZoneEnv[];
  envStable: boolean;
}

export const zones: Zone[] = [
  {
    id: "receiving",
    name: "Receiving",
    icon: "truck",
    status: "complete",
    statusNote: "Intake 120 lots",
    tagline: "Inbound trucks, manifests, and intake",
    listTitle: "Active Deliveries",
    stats: [
      { label: "dock_status", value: "3", unit: "Active Docks" },
      { label: "expected_deliveries", value: "8", unit: "Trailers Today" },
      { label: "daily_intake", value: "140", unit: "Total Units" },
    ],
    rows: [
      {
        id: "TRK-88",
        title: "Truck #88",
        subtitle: "North Plains Ranching",
        status: { label: "Intake in progress", tone: "active" },
        metrics: [
          { label: "units_logged", value: "40 / 120" },
          { label: "dock_assignment", value: "DOCK-04" },
        ],
      },
      {
        id: "TRK-92",
        title: "Truck #92",
        subtitle: "Heritage Valley Farms",
        status: { label: "Awaiting dock", tone: "pending" },
        metrics: [
          { label: "manifest_units", value: "60 Units" },
          { label: "arrival_time", value: "08:14 AM" },
        ],
      },
    ],
    actions: ["Log Incoming Lot", "Verify manifest", "Update inventory"],
    env: [
      { label: "ambient_temp", value: 4.2, unit: "°C", decimals: 1 },
      { label: "humidity", value: 84, unit: "%", decimals: 0 },
    ],
    envStable: true,
  },
  {
    id: "killfloor",
    name: "Kill Floor",
    icon: "blade",
    status: "complete",
    statusNote: "Cleared 14:30",
    tagline: "Slaughter line throughput and PPE safety",
    listTitle: "Active Stations",
    stats: [
      { label: "line_speed", value: "62", unit: "head / hr" },
      { label: "carcasses_today", value: "486", unit: "Processed" },
      { label: "ppe_compliance", value: "100", unit: "% Clear" },
    ],
    rows: [
      {
        id: "ST-1",
        title: "Stun & Bleed",
        subtitle: "Station 1 · J. Doe",
        status: { label: "Running", tone: "active" },
        metrics: [
          { label: "rate", value: "62 / hr" },
          { label: "vision_qc", value: "Pass" },
        ],
      },
      {
        id: "ST-2",
        title: "Evisceration",
        subtitle: "Station 2 · M. Smith",
        status: { label: "PPE alert cleared", tone: "good" },
        metrics: [
          { label: "yield_vs_spec", value: "98.1%" },
          { label: "ppe", value: "Compliant" },
        ],
      },
    ],
    actions: ["Flag Defect", "Sanitation Log", "Pause Line"],
    env: [
      { label: "floor_temp", value: 11.4, unit: "°C", decimals: 1 },
      { label: "humidity", value: 71, unit: "%", decimals: 0 },
    ],
    envStable: true,
  },
  {
    id: "processing",
    name: "Processing",
    icon: "knife",
    status: "active",
    statusNote: "42 units pending",
    tagline: "Cut lines, yield against spec, and grading",
    listTitle: "Active Cut Lines",
    stats: [
      { label: "units_pending", value: "42", unit: "in queue" },
      { label: "yield_vs_spec", value: "92.4", unit: "%" },
      { label: "cut_lines", value: "3", unit: "Running" },
    ],
    rows: [
      {
        id: "LINE-1",
        title: "Line 1 — Primal Cuts",
        subtitle: "Beef · AAA spec",
        status: { label: "Active", tone: "active" },
        metrics: [
          { label: "yield", value: "92.4%" },
          { label: "defects", value: "2 flagged" },
        ],
      },
      {
        id: "LINE-2",
        title: "Line 2 — Boning",
        subtitle: "Pork · standard",
        status: { label: "Active", tone: "active" },
        metrics: [
          { label: "yield", value: "90.8%" },
          { label: "throughput", value: "318 / hr" },
        ],
      },
    ],
    actions: ["Reassign Cut", "Yield Report", "Flag Foreign Material"],
    env: [
      { label: "room_temp", value: 6.1, unit: "°C", decimals: 1 },
      { label: "humidity", value: 78, unit: "%", decimals: 0 },
    ],
    envStable: true,
  },
  {
    id: "wetaging",
    name: "Wet Aging",
    icon: "snow",
    status: "pending",
    statusNote: "Awaiting Batch 4B",
    tagline: "Cooler racks, aging time, and atmosphere",
    listTitle: "Active Racks",
    stats: [
      { label: "cooler_capacity", value: "78", unit: "%" },
      { label: "avg_aging_time", value: "14", unit: "Days" },
      { label: "critical_alerts", value: "0", unit: "Nominal" },
    ],
    rows: [
      {
        id: "LOT-A101",
        title: "Lot A-101",
        subtitle: "T-Bone Select",
        status: { label: "Ready soon", tone: "good" },
        metrics: [
          { label: "age", value: "Day 12" },
          { label: "units", value: "120" },
        ],
      },
      {
        id: "LOT-B202",
        title: "Lot B-202",
        subtitle: "Ribeye Prime",
        status: { label: "Aging start", tone: "idle" },
        metrics: [
          { label: "age", value: "Day 4" },
          { label: "units", value: "85" },
        ],
      },
    ],
    actions: ["Move to Value Add", "Temp Log Override", "Inventory Audit"],
    env: [
      { label: "temperature", value: 34.2, unit: "°F", decimals: 1 },
      { label: "humidity", value: 85, unit: "%", decimals: 0 },
      { label: "co2_levels", value: 412, unit: "ppm", decimals: 0 },
    ],
    envStable: true,
  },
  {
    id: "valueadd",
    name: "Value Add",
    icon: "box",
    status: "idle",
    statusNote: "Scheduled 16:00",
    tagline: "Prep projects, marination, and custom cuts",
    listTitle: "Current Projects",
    stats: [
      { label: "prep_quota", value: "65", unit: "%" },
      { label: "active_staff", value: "08", unit: "5 / 6 manned" },
      { label: "prep_stations", value: "06", unit: "Operational" },
    ],
    rows: [
      {
        id: "BATCH-12",
        title: "Marination Batch",
        subtitle: "Batch #12 · 50 units",
        status: { label: "Active", tone: "active" },
        metrics: [
          { label: "soak_time", value: "02:45:00" },
          { label: "station", value: "S-04_B" },
        ],
      },
      {
        id: "ORDER-77",
        title: "Custom Cuts",
        subtitle: "Order #77 · 12 units",
        status: { label: "Priority", tone: "pending" },
        metrics: [
          { label: "station", value: "S-04_B" },
          { label: "due", value: "16:00" },
        ],
      },
    ],
    actions: ["Start New Project", "Label Printing", "Waste Log"],
    env: [
      { label: "zone_temp", value: 4.2, unit: "°C", decimals: 1 },
      { label: "station_humidity", value: 82, unit: "%", decimals: 0 },
    ],
    envStable: true,
  },
  {
    id: "shipping",
    name: "Shipping",
    icon: "ship",
    status: "idle",
    statusNote: "Bay 1 available",
    tagline: "Outbound loads, manifests, and dispatch",
    listTitle: "Outbound Loads",
    stats: [
      { label: "open_bays", value: "2", unit: "Available" },
      { label: "loads_today", value: "5", unit: "Dispatched" },
      { label: "on_time_rate", value: "98", unit: "%" },
    ],
    rows: [
      {
        id: "LOAD-31",
        title: "Load #31 — Great Lakes",
        subtitle: "Bay 2 · 18 pallets",
        status: { label: "Loading", tone: "active" },
        metrics: [
          { label: "manifest", value: "Sealed" },
          { label: "depart", value: "15:30" },
        ],
      },
      {
        id: "LOAD-32",
        title: "Load #32 — Chicago Co.",
        subtitle: "Bay 1 · staged",
        status: { label: "Staged", tone: "idle" },
        metrics: [
          { label: "pallets", value: "12" },
          { label: "depart", value: "17:00" },
        ],
      },
    ],
    actions: ["Seal Manifest", "Assign Bay", "Print BOL"],
    env: [
      { label: "dock_temp", value: 5.8, unit: "°C", decimals: 1 },
      { label: "humidity", value: 74, unit: "%", decimals: 0 },
    ],
    envStable: true,
  },
];

/* -------- Unified dashboard (Daily Workflow + Ops merged) -------- */
export const workflowProgress = 68;

export interface ActivityItem {
  id: string;
  text: string;
  actor: string;
  time: string;
  tone: "live" | "muted" | "rust";
}
export const activityLog: ActivityItem[] = [
  { id: "a1", text: "Batch 42 moved to Processing", actor: "operator: j. doe", time: "14:32", tone: "live" },
  { id: "a2", text: "Kill Floor clearance confirmed", actor: "system auto", time: "14:30", tone: "muted" },
  { id: "a3", text: "Compliance record sealed on blockchain", actor: "system auto", time: "14:18", tone: "rust" },
  { id: "a4", text: "Intake Lot 88 received at Dock-04", actor: "operator: m. smith", time: "12:15", tone: "muted" },
  { id: "a5", text: "PPE alert cleared at Station 2", actor: "vision ai", time: "11:48", tone: "live" },
];

export const opsMetrics = [
  { label: "active_bins", value: 38, unit: "" },
  { label: "overdue", value: 2, unit: "" },
  { label: "done_today", value: 126, unit: "" },
  { label: "compliance", value: 100, unit: "%" },
];

export const opsCycles = [
  { id: "BIN-7741", stream: "Tallow", weight: "412 lb", value: "$1,758", status: { label: "Sold", tone: "good" as const }, buyer: "Great Lakes Rendering" },
  { id: "BIN-7742", stream: "Bone meal", weight: "286 lb", value: "$540", status: { label: "Routed", tone: "active" as const }, buyer: "Midwest Byproducts" },
  { id: "BIN-7743", stream: "Hides", weight: "1,020 lb", value: "$2,140", status: { label: "Sealed", tone: "complete" as const }, buyer: "Heritage Leather Co." },
  { id: "BIN-7744", stream: "Organs", weight: "168 lb", value: "$390", status: { label: "Overdue", tone: "alert" as const }, buyer: "Pending pickup" },
];

export const environmental = [
  { label: "wet_aging_temp", value: 34.2, unit: "°F", decimals: 1 },
  { label: "processing_humidity", value: 52, unit: "%", decimals: 0 },
  { label: "facility_co2", value: 412, unit: "ppm", decimals: 0 },
];

export const carbon = { credits: 418, unit: "t CO2e", revenue: 61420 };

/* -------- Supplier shipments -------- */
export const shipments = [
  { id: "SHP-WW2W6Z", ref: "123", supplier: "North Plains Ranching", facility: "Great Lakes Rendering", qty: 1000, received: "4 Jun, 05:38", condition: "Good" },
  { id: "SHP-8BHZUQ", ref: "12345", supplier: "Heritage Valley Farms", facility: "Chicago Processing", qty: 21, received: "3 Jun, 00:43", condition: "Good" },
  { id: "SHP-3KD9PL", ref: "204", supplier: "Cedar Ridge Co-op", facility: "Great Lakes Rendering", qty: 540, received: "3 Jun, 22:10", condition: "Damaged" },
];

/* -------- Timesheet -------- */
export const timesheet = [
  { id: "EMP-01", name: "Jordan Doe", department: "Kill Floor", sessions: 2, hours: 8.2, status: "On site" },
  { id: "EMP-02", name: "Marisol Smith", department: "Processing", sessions: 1, hours: 6.5, status: "On site" },
  { id: "EMP-03", name: "Ade Okafor", department: "Receiving", sessions: 3, hours: 7.9, status: "Checked out" },
  { id: "EMP-04", name: "Priya Nair", department: "Value Add", sessions: 1, hours: 4.1, status: "On site" },
];

export const recentScans = [
  { id: "s1", name: "Jordan Doe", action: "Check in", time: "06:02", gate: "Gate A" },
  { id: "s2", name: "Ade Okafor", action: "Check out", time: "14:31", gate: "Gate A" },
  { id: "s3", name: "Priya Nair", action: "Check in", time: "10:00", gate: "Gate B" },
];

/* -------- Forms -------- */
export interface FormDef {
  id: string;
  name: string;
  desc: string;
  type: "Multi-Section" | "Checklist";
  fields: number;
}
export const forms: FormDef[] = [
  { id: "f-daily-bin", name: "Daily Bin Form", desc: "Per-bin byproduct weights, condition, and routing for the day.", type: "Multi-Section", fields: 9 },
  { id: "f-est183", name: "Est 183 Feeding and Watering Livestock", desc: "Monitoring procedures: inspect pens, gates, rails, chutes, and welfare on arrival.", type: "Multi-Section", fields: 14 },
  { id: "f-equipment", name: "Equipment Review Form", desc: "Evaluate equipment, instruments, and food contact surfaces against compliance criteria.", type: "Checklist", fields: 12 },
  { id: "f-complaint", name: "Customer Complaint Investigation Form", desc: "Record and investigate product or service complaints from customers.", type: "Multi-Section", fields: 11 },
  { id: "f-allergen", name: "Allergen Checklist", desc: "Verify allergen controls, labeling, and cross-contact prevention.", type: "Checklist", fields: 8 },
  { id: "f-receiving", name: "Plant Receiving Record — Meat & Non-Meat", desc: "Log inbound meat and non-meat receipts with supplier, temp, and condition.", type: "Multi-Section", fields: 16 },
];

/* -------- Animal lifecycle (carcass passport) -------- */
export const lifecycleStages = ["Intake", "Slaughter", "Aging", "Grading", "Processing", "Delivery"];
