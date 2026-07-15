
import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/app/Logo";
import { Icon } from "@/components/ui/Icon";
import { Card, Badge } from "@/components/ui/primitives";
import { ScanPanel } from "@/components/app/ScanPanel";

const pickups = [
  { id: "BIN-7741", stream: "Tallow", weight: "412 lb", time: "13:20", action: "Picked up" },
  { id: "BIN-7738", stream: "Bone meal", weight: "286 lb", time: "11:05", action: "Delivered" },
  { id: "BIN-7729", stream: "Hides", weight: "1,020 lb", time: "09:40", action: "Delivered" },
];

export default function DriverPortalPage() {
  const [tab, setTab] = useState<"scan" | "dashboard">("scan");

  return (
    <div className="min-h-screen bg-canvas">
      <div aria-hidden className="pointer-events-none fixed inset-0 data-grid-bg opacity-50" />
      <div className="relative mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl border border-edge/70 bg-white p-4 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
              <Icon name="truck" width={22} height={22} />
            </span>
            <div>
              <h1 className="font-display text-lg font-extrabold text-olive-deep">Driver Portal</h1>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">John Doe · Truck-01</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-edge bg-bone-light/50 p-1">
            {(["scan", "dashboard"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  tab === t ? "bg-olive-deep text-bone-light" : "text-muted hover:text-olive-deep"
                }`}
              >
                {t === "scan" ? "Bin" : "Dashboard"}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-6">
          {tab === "scan" ? (
            <ScanPanel
              title="Scan a Bin"
              subtitle="Ready to pick up or deliver? Scan the QR code on the bin to continue."
              icon="box"
              placeholder="Enter QR code manually"
              makeCode={() => "BIN-" + Math.floor(7000 + Math.random() * 999)}
              renderResult={(code, reset) => (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-edge/60 bg-bone-light/50 p-5">
                    <div>
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">{code}</p>
                      <h2 className="mt-1 font-display text-xl font-extrabold text-olive-deep">Bin located</h2>
                    </div>
                    <Badge tone="good">Ready</Badge>
                  </div>
                  <div className="flex flex-col gap-2 p-5">
                    <button className="rounded-xl bg-olive-deep px-4 py-3 text-sm font-semibold text-bone-light hover:bg-olive-deep/90">Log pickup</button>
                    <button className="rounded-xl bg-rust px-4 py-3 text-sm font-semibold text-canvas hover:bg-rust/90">Log delivery</button>
                    <button onClick={reset} className="rounded-xl border border-edge bg-white px-4 py-3 text-sm font-semibold text-muted hover:bg-bone-light">Scan another bin</button>
                  </div>
                </Card>
              )}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-edge/60 p-5">
                <h2 className="font-display text-lg font-bold text-olive-deep">Today&apos;s runs</h2>
                <p className="mt-1 text-sm text-muted">Bins you picked up or delivered.</p>
              </div>
              <ul className="divide-y divide-edge/40">
                {pickups.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bone-light text-olive-deep"><Icon name="box" width={18} height={18} /></span>
                    <div className="flex-1">
                      <p className="font-mono text-xs text-olive-deep">{p.id}</p>
                      <p className="text-sm font-semibold text-ink">{p.stream} · {p.weight}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone={p.action === "Picked up" ? "active" : "good"}>{p.action}</Badge>
                      <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">{p.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Link to="/dashboard" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
          <Icon name="arrow" width={14} height={14} className="rotate-180" /> Back to facility
        </Link>
      </div>
    </div>
  );
}
