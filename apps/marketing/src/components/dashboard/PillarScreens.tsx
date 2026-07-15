
import type { ReactNode } from "react";
import { useTicker, useIncrement } from "@/lib/hooks";
import type { PillarId } from "@/data/pillars";
import { Screen, Bar, Tag, LiveDot } from "./primitives";
import { GasNode } from "./GasNode";

function Row({
  left,
  right,
  sub,
}: {
  left: ReactNode;
  right: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge/50 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{left}</p>
        {sub && <p className="font-mono text-[0.62rem] text-muted">{sub}</p>}
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  );
}

function Check() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-olive/15 text-olive">
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5.2L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/* ---------------------------------- Hardware ---------------------------------- */
function HardwareScreen() {
  const weight = useTicker({ base: 918.6, amplitude: 6, decimals: 1, intervalMs: 2400 });
  const devices = [
    { name: "Kill floor cameras", stat: "6 online", tone: "olive" as const },
    { name: "Floor scales", stat: `${weight.toFixed(1)} lb`, tone: "olive" as const },
    { name: "Voice headsets", stat: "12 paired", tone: "olive" as const },
    { name: "Zone sensors", stat: "8 nominal", tone: "olive" as const },
  ];
  return (
    <Screen title="Floor Hardware · Live" badge="Capturing">
      <div className="rounded-xl border border-edge/70 bg-white p-3.5">
        <GasNode />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {devices.map((d) => (
          <div key={d.name} className="flex items-center justify-between rounded-xl border border-edge/70 bg-bone-light/40 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-olive-deep">{d.name}</p>
              <p className="font-mono text-[0.64rem] tabular-nums text-muted">{d.stat}</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-olive" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

/* ------------------------------------- AI ------------------------------------- */
function AIScreen() {
  const yieldV = useTicker({ base: 92.4, amplitude: 0.7, decimals: 1, intervalMs: 2200 });
  return (
    <Screen title="Vision AI · Line 2" badge="Inspecting">
      {/* camera frame */}
      <div className="relative overflow-hidden rounded-xl border border-edge/70 bg-[#2f3322] p-4">
        <div aria-hidden className="absolute inset-0 data-grid-bg-dark opacity-70" />
        <div className="relative flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.12em] text-bone/60">
          <span className="flex items-center gap-1.5"><LiveDot /> Cam 02 · workstation 4</span>
          <span>full line speed</span>
        </div>
        {/* wireframe carcass + bounding boxes */}
        <div className="relative mx-auto my-4 h-24 w-full max-w-[220px]">
          <div className="absolute left-[18%] top-[10%] h-[80%] w-[64%] rounded-[40%_40%_30%_30%] border border-bone/25" />
          <div className="absolute left-[26%] top-[20%] h-[34%] w-[48%] rounded border border-olive/80">
            <span className="absolute -top-4 left-0 bg-olive px-1 font-mono text-[0.55rem] text-canvas">
              yield {yieldV.toFixed(1)}%
            </span>
          </div>
          <div className="absolute bottom-[14%] right-[24%] h-[24%] w-[26%] rounded border border-rust/80">
            <span className="absolute -bottom-4 right-0 bg-rust px-1 font-mono text-[0.55rem] text-canvas">
              trim guide
            </span>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2 font-mono text-[0.6rem] text-bone/70">
          <span>Defects: <span className="text-olive">none</span></span>
          <span>Foreign: <span className="text-olive">clear</span></span>
          <span>Grade: <span className="text-bone">AAA</span></span>
        </div>
      </div>

      {/* Butcher Talk */}
      <div className="mt-3 rounded-xl border border-edge/70 bg-bone-light/40 p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">Butcher Talk · speech to record</p>
          <Tag tone="rust">captured</Tag>
        </div>
        <p className="mt-2 text-sm italic text-ink/70">“Tag 402, 900 pounds, Grade AAA”</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag>ID 402</Tag>
          <Tag>900 lb</Tag>
          <Tag>Grade AAA</Tag>
        </div>
      </div>

      {/* PPE alert */}
      <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-rust/30 bg-rust/[0.06] px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rust/15 text-rust">!</span>
        <p className="text-xs text-ink/80">PPE check · station 7 missing hairnet, flagged 0.3s</p>
      </div>
    </Screen>
  );
}

/* --------------------------------- Operations --------------------------------- */
const passportStages = [
  { name: "Receiving", done: true },
  { name: "Slaughter", done: true },
  { name: "Aging", done: true },
  { name: "Grading", done: true },
  { name: "Processing", done: false },
  { name: "Delivery", done: false },
];
function OperationsScreen() {
  const onSite = useIncrement({ start: 38, step: 1, intervalMs: 5200 });
  return (
    <Screen title="Operations · Today" badge="On site">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { l: "On site", v: onSite },
          { l: "Animals in", v: 214 },
          { l: "Deliveries", v: 9 },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-edge/70 bg-bone-light/40 p-2.5 text-center">
            <p className="font-display text-lg font-extrabold tabular-nums text-olive-deep">{s.v}</p>
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{s.l}</p>
          </div>
        ))}
      </div>

      {/* passport */}
      <div className="mt-3 rounded-xl border border-edge/70 bg-white p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-olive-deep">Carcass passport · Tag 402</p>
          <Tag tone="olive">live</Tag>
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1">
          {passportStages.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${s.done ? "bg-olive" : "border border-edge bg-canvas"}`} />
              <span className={`text-center text-[0.55rem] leading-tight ${s.done ? "text-olive-deep" : "text-muted"}`}>
                {s.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* check-ins + driver */}
      <div className="mt-3">
        <Row left="M. Alvarez · Line 2" right={<Tag tone="green">in 06:58</Tag>} sub="badge 1182" />
        <Row left="Driver · Bin scan B-204" right={<Tag tone="rust">pickup</Tag>} sub="hides · routed" />
        <Row left="Shipment 41 · Hillcrest Farm" right={<span className="font-mono text-xs text-ink">1,240 lb</span>} sub="condition: good" />
      </div>
    </Screen>
  );
}

/* --------------------------------- Compliance --------------------------------- */
function ComplianceScreen() {
  const temp = useTicker({ base: 2.1, amplitude: 0.4, decimals: 1, intervalMs: 2600 });
  return (
    <Screen title="Compliance · HACCP" badge="Sealed">
      <div className="rounded-xl border border-edge/70 bg-white p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-olive-deep">Daily sanitation record · auto filled</p>
          <Tag tone="olive">8 program areas</Tag>
        </div>
        <div className="mt-2">
          <Row left="Cooler temperature" right={<span className="font-mono text-xs tabular-nums text-ink">{temp.toFixed(1)} °C</span>} sub="sensor · auto" />
          <Row left="Pre op sanitation" right={<Check />} sub="verified" />
          <Row left="CCP 1 · chill log" right={<Check />} sub="from sensor" />
          <Row left="Calibration drift" right={<Tag tone="green">within range</Tag>} sub="trail current" />
        </div>
      </div>

      {/* blockchain seal */}
      <div className="mt-3 rounded-xl border border-olive/30 bg-olive/[0.06] p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-olive">Post on blockchain</p>
          <Tag tone="olive">anchored</Tag>
        </div>
        <p className="mt-2 break-all font-mono text-[0.66rem] text-ink/70">
          0x7b3f…a921 · block 4,182,664 · sealed 09:14:22
        </p>
        <p className="mt-1.5 text-[0.68rem] text-muted">
          Independently checkable. Cannot be edited, deleted, or backdated.
        </p>
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-xl border border-edge/70 bg-bone-light/40 px-3.5 py-2.5">
        <p className="text-xs text-muted">Tamper proof archive</p>
        <p className="font-mono text-sm font-semibold tabular-nums text-olive-deep">41,907 records</p>
      </div>
    </Screen>
  );
}

/* ---------------------------------- Recovery ---------------------------------- */
function RecoveryScreen() {
  const credits = useIncrement({ start: 418, step: 1, intervalMs: 3400 });
  const bins = [
    { name: "Tallow", w: "412 lb", v: "$486", pct: 82 },
    { name: "Bone meal", w: "338 lb", v: "$312", pct: 64 },
    { name: "Organs", w: "204 lb", v: "$540", pct: 88 },
    { name: "Hides", w: "6 units", v: "$420", pct: 70 },
  ];
  return (
    <Screen title="Recovery · Byproduct" badge="Earning">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-edge/70 bg-bone-light/40 p-3">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Recovered today</p>
          <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-olive-deep">$1,758</p>
        </div>
        <div className="rounded-xl border border-edge/70 bg-bone-light/40 p-3">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Carbon credits</p>
          <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-rust">{credits}t CO2e</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-edge/70 bg-white p-3.5">
        <p className="mb-2 text-xs font-semibold text-olive-deep">Bin streams · routed to highest value</p>
        {bins.map((b) => (
          <div key={b.name} className="py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">{b.name}</span>
              <span className="font-mono text-xs text-muted">
                {b.w} · <span className="text-olive-deep">{b.v}</span>
              </span>
            </div>
            <Bar value={b.pct} className="mt-1.5" tone="olive" />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-olive/30 bg-olive/[0.06] px-3.5 py-2.5">
        <span className="text-olive">↻</span>
        <p className="text-xs text-ink/80">Buyer matched · tallow stream → renderer, verified seal attached</p>
      </div>
    </Screen>
  );
}

export const pillarScreens: Record<PillarId, () => ReactNode> = {
  hardware: HardwareScreen,
  ai: AIScreen,
  operations: OperationsScreen,
  compliance: ComplianceScreen,
  recovery: RecoveryScreen,
};
