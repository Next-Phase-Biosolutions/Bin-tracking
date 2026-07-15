export type PillarId =
  | "hardware"
  | "ai"
  | "operations"
  | "compliance"
  | "recovery";

export interface PillarTool {
  name: string;
  detail: string;
}

export interface PillarValue {
  label: string;
  detail: string;
}

export interface Pillar {
  id: PillarId;
  index: string;
  name: string;
  layer: string;
  lede: string;
  idea: string;
  tools: PillarTool[];
  value: PillarValue[];
  connects: string;
}

export const pillars: Pillar[] = [
  {
    id: "hardware",
    index: "01",
    name: "Hardware",
    layer: "The physical layer",
    lede: "Senses, sees, weighs, and listens on the floor, turning what happens to a real animal into data the rest of the system can act on.",
    idea: "Before you can manage, prove, or recover anything, you have to measure it. This pillar is the eyes, ears, and hands of the whole platform, the ground truth everything else is built on.",
    tools: [
      {
        name: "The M1 five gas node",
        detail:
          "A self contained device on the exterior wall, with a probe at the emission source sampling the air around the clock. It measures five hazardous gases at once: methane, the gas your carbon credits are calculated from, carbon dioxide, the emissions benchmark, and the worker safety gases hydrogen sulphide, ammonia, and carbon monoxide. Each is read by its own industrial grade, auditor accepted sensor, because hobby grade parts cross react and carry no calibration trail, so an auditor rejects their data. Only two passive parts sit in the hazardous zone; all electronics stay in a sealed, washdown proof enclosure.",
      },
      {
        name: "Kill floor cameras",
        detail:
          "Waterproof cameras at every workstation and along the line that measure yield, catch defects and foreign material, and watch that safety rules are followed.",
      },
      {
        name: "Floor scales and load cells",
        detail:
          "Real catch weights captured at the point of work, not written on a tag and keyed in later.",
      },
      {
        name: "Bone conduction headsets",
        detail:
          "Rugged, hands free voice capture built for a wet, loud, fast floor where keyboards fail.",
      },
      {
        name: "Environmental sensors",
        detail:
          "Temperature, humidity, and CO2 across every zone, from receiving to wet aging, feeding the dashboards live.",
      },
      {
        name: "QR bin tags and badge scanners",
        detail:
          "Physical tracking of every byproduct bin, plus badge scanners for employee check in and check out.",
      },
      {
        name: "On site edge nodes",
        detail:
          "Hardened floor computers that capture data locally and call on heavy computing only when needed, keeping the system fast and cheap.",
      },
    ],
    value: [
      { label: "Accuracy", detail: "Numbers come from real scales, cameras, and sensors, not memory or a whiteboard." },
      { label: "Time", detail: "The measuring happens by itself, around the clock, with no clipboards." },
      { label: "Money", detail: "You stop losing what you could not see: off spec cuts, untracked byproduct, escaping gas." },
      { label: "Less stress", detail: "The floor is watched every hour, including gases that can harm a worker unnoticed." },
    ],
    connects:
      "Everything else runs on what this layer captures. Readings flow up into the AI that interprets them, surface in the ERP where staff see them, are sealed by Compliance, and become the raw material Recovery turns into sales and carbon credits.",
  },
  {
    id: "ai",
    index: "02",
    name: "AI",
    layer: "The intelligence layer",
    lede: "Takes the raw facts the floor captures and turns them into a measurement, a warning, a finished record, without a person doing it by hand.",
    idea: "Capturing data is only half the battle; someone still has to make sense of it. This pillar is that someone, watching everything at once, catching what a busy team cannot, and doing the tedious work automatically.",
    tools: [
      {
        name: "Vision AI",
        detail:
          "Watches the line and every workstation: it measures yield against customer spec, guides trimming so cuts are not given away, catches defects and foreign material, and grades and sorts at full line speed, inspecting every piece where people only sample and tire.",
      },
      {
        name: "Safety and QC detection",
        detail:
          "Flags missing PPE, equipment not sanitized after slaughter, or a skipped step, the moment it happens.",
      },
      {
        name: "Butcher Talk, speech to record",
        detail:
          "Understands kill floor shorthand. A spoken “Tag 402, 900 pounds, Grade AAA” becomes a clean record with ID, weight, and grade, with no keyboard.",
      },
      {
        name: "Voice driven forms",
        detail:
          "Intake and registration that fill themselves from a single spoken pass instead of field by field typing.",
      },
      {
        name: "Form digitization",
        detail:
          "Photograph a paper form, even a handwritten one, and it becomes a structured digital form, so your existing paperwork comes along.",
      },
      {
        name: "The agents",
        detail:
          "Purpose built assistants for profit and cash flow, production and labour, byproduct value, sensor driven compliance, an owner's overview, and threshold alerts, all aimed at putting money back in the owner's pocket.",
      },
    ],
    value: [
      { label: "Accuracy", detail: "Every cut, record, and form is handled the same way every time, with no fatigue." },
      { label: "Time", detail: "Paperwork, data entry, and inspection now happen on their own." },
      { label: "Money", detail: "Quiet leaks surface weeks before month end, from over trim to undersold byproduct." },
      { label: "Less stress", detail: "An extra set of eyes that never blinks, so the team is not relying on luck." },
    ],
    connects:
      "It reads the hardware, writes its results into the ERP, hands Compliance the safety flags and auto filled records, and feeds Recovery its missed value alerts. The intelligence here has value because it is wired into everything else: it sees through the hardware and acts through the rest of the platform.",
  },
  {
    id: "operations",
    index: "03",
    name: "Operations",
    layer: "The people and logistics layer",
    lede: "Knows who is on site, what came through the door, where every animal and bin is, and which suppliers are actually worth your money.",
    idea: "A plant does not just process meat; it runs on people, deliveries, and movement. This pillar keeps track of all of it, so what normally lives in someone's head or a stack of forms becomes a clear, shared record.",
    tools: [
      {
        name: "Employee onboarding",
        detail:
          "New staff entered with their role and department, tied to the work they actually do.",
      },
      {
        name: "Check in and check out",
        detail:
          "A badge scan clocks each person in and out at the gate, with no paper sign in sheet.",
      },
      {
        name: "Timesheets and hours",
        detail:
          "Hours per employee by date range, a live on site count, and a feed of recent scans, so payroll is not a month end reconstruction.",
      },
      {
        name: "Driver portal",
        detail:
          "Drivers see their truck and scan a bin's QR code to log a pickup or delivery as it happens.",
      },
      {
        name: "Shipment recording",
        detail:
          "Inbound deliveries logged on arrival with supplier, quantity, weight, and condition, plus running totals including damage.",
      },
      {
        name: "Animal registration",
        detail:
          "Every animal registered at intake, by voice, in one pass.",
      },
      {
        name: "Carcass lifecycle passport",
        detail:
          "A digital passport per animal across receiving, slaughter, aging, grading, processing, and delivery, searchable by tag number, with byproducts tracked by lot and bin.",
      },
      {
        name: "Farm quality and profitability",
        detail:
          "Average yield and grade per supplying farm, mapping which suppliers deliver the best margins.",
      },
    ],
    value: [
      { label: "Accuracy", detail: "Hours, deliveries, and movements are logged at the source by the people involved." },
      { label: "Time", detail: "No logbooks or sign in sheets; the record is created as the work is done." },
      { label: "Money", detail: "You finally see which suppliers truly deliver the best margins." },
      { label: "Less stress", detail: "Where an animal went or who was on the floor is answered instantly." },
    ],
    connects:
      "It gives a name, a time, and an owner to everything the platform measures, all surfaced in the ERP and feeding the audit ready trail Compliance depends on. Operations is the human activity that gives the rest of the system its context.",
  },
  {
    id: "compliance",
    index: "04",
    name: "Compliance",
    layer: "The verification layer",
    lede: "Proves everything the facility does is accurate, follows the rules, and cannot be quietly changed after the fact, so an audit is something you are always ready for.",
    idea: "Being compliant is not enough; you have to prove it, on demand, to an inspector who can show up unannounced. This pillar turns proof from a paperwork fire drill into something always sitting ready.",
    tools: [
      {
        name: "Digital CFIA, OMAFRA, and HACCP forms",
        detail:
          "Records across eight program areas, moved off paper into a searchable, timestamped library, captured as the work happens.",
      },
      {
        name: "Ready made and custom forms",
        detail:
          "A library of common forms in checklist and multi section formats, or build your own, including by photographing a paper form.",
      },
      {
        name: "Auto filled records",
        detail:
          "Compliance fields populated automatically from live sensor readings, with calibration and drift tracked so a slipping sensor is caught early.",
      },
      {
        name: "Tamper proof archive",
        detail:
          "Once written, records cannot be edited, deleted, or backdated by anyone, and are kept for years in immutable storage.",
      },
      {
        name: "Blockchain verification",
        detail:
          "Record summaries anchored on a public blockchain as an independently checkable seal, the Post on Blockchain step, so a verifier need not take your word.",
      },
      {
        name: "Independent calibration trail",
        detail:
          "Accredited certificates, renewed on schedule, so the numbers trace to a recognized standard, not just the device.",
      },
    ],
    value: [
      { label: "Accuracy", detail: "Records reflect exactly what was measured and when, then are frozen." },
      { label: "Time", detail: "The hours lost to binders and audit prep largely disappear." },
      { label: "Money", detail: "Protection from the heavy cost of a failed audit, slow recall, or lost certification." },
      { label: "Less stress", detail: "An unannounced inspection stops being a crisis." },
    ],
    connects:
      "It seals everything the floor produces into dated, provable records, shows compliance standing in the ERP, and is what makes Recovery's carbon credits real, because a credit is only worth something if the data behind it is verified and untouchable.",
  },
  {
    id: "recovery",
    index: "05",
    name: "Recovery",
    layer: "The recovery layer",
    lede: "Turns the parts of the animal a plant used to pay to throw away into two new sources of income, byproduct sales and verified carbon credits.",
    idea: "Every carcass has value left in it after the cut, in the fat, bones, organs, hides, and trim. This pillar captures that value instead of sending it to landfill, then earns again by turning the avoided waste into carbon credits.",
    tools: [
      {
        name: "Inventory and upcycling tracking",
        detail:
          "A live view of edible inventory and non edible byproducts, from tallow and bone meal to blood, organs, and hides, with spoilage alerts and a tally of emissions avoided.",
      },
      {
        name: "Byproduct recovery operations",
        detail:
          "Setting up the streams: sorting, weighing, collecting, and routing fat, bones, organs, hides, and trim to their highest value market.",
      },
      {
        name: "A market for what was waste",
        detail:
          "By reliably supplying these streams we become the trusted link between abattoirs and the buyers who want the material, with no separate marketplace app to manage.",
      },
      {
        name: "Bin level tracking",
        detail:
          "Every byproduct bin traced by ID, contents, facility, and cycle, from separation to sale or diversion.",
      },
      {
        name: "The carbon credit program",
        detail:
          "Diverting organic waste from landfill avoids methane; that avoidance, measured and independently verified, becomes a sellable credit. The credits count for the streams that would otherwise have been thrown away, which is exactly the material this pillar recovers.",
      },
    ],
    value: [
      { label: "Accuracy", detail: "Every stream is weighed and tracked, not estimated." },
      { label: "Time", detail: "Routing and credit documentation are organized, not improvised." },
      { label: "Money", detail: "A disposal cost becomes revenue, then earns again as carbon credits." },
      { label: "Less stress", detail: "Waste handling becomes a documented income source, not a headache." },
    ],
    connects:
      "It runs on the hardware's readings, Operations' bin and animal records, and Compliance's verified proof, all surfaced in the ERP. On its own it is careful waste handling; wired into the other four pillars, it becomes a verified, revenue generating engine where the whole system pays off.",
  },
];
