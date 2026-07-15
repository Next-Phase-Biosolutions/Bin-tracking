
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { ScanPanel } from "@/components/app/ScanPanel";
import { trpc, apiConfigured } from "@/lib/trpc";

const streams = ["Tallow", "Bone meal", "Blood", "Organs", "Hides", "Trim"];

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Live result: looks the scanned code up via bin.getByQrCode. */
function LiveBinResult({ code, reset }: { code: string; reset: () => void }) {
  const q = trpc.bin.getByQrCode.useQuery({ qrCode: code }, { retry: false });

  if (q.isLoading) {
    return (
      <Card className="flex items-center gap-3 p-8">
        <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
        <p className="font-mono text-sm text-muted">Looking up {code}…</p>
      </Card>
    );
  }

  if (q.error || !q.data) {
    return (
      <Card className="p-8 text-center">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">{code}</p>
        <h2 className="mt-2 font-display text-xl font-bold text-rust">Bin not found</h2>
        <p className="mt-1 text-sm text-muted">No bin matches this QR code at your facilities.</p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light"
        >
          Scan next
        </button>
      </Card>
    );
  }

  const bin = q.data;
  const active = bin.status === "ACTIVE" || bin.status === "IN_TRANSIT";
  const cells = [
    { k: "organ", v: cap(bin.binType?.organType ?? "—") },
    { k: "facility", v: bin.currentFacility?.name ?? "—" },
    { k: "urgency", v: cap((bin.binType?.urgency ?? "—").toLowerCase()) },
    { k: "cycle", v: bin.activeCycle ? "Active" : "Idle" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-edge/60 bg-bone-light/50 p-5">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">{bin.qrCode}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-olive-deep">{cap(bin.binType?.organType ?? "Bin")} bin</h2>
        </div>
        <Badge tone={active ? "active" : "idle"}>{cap(bin.status.toLowerCase())}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-px bg-edge/40 sm:grid-cols-4">
        {cells.map((d) => (
          <div key={d.k} className="bg-white p-4">
            <p className="kicker">{d.k}</p>
            <p className="mt-1 font-semibold text-olive-deep">{d.v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 p-5">
        <button className="flex-1 rounded-xl bg-olive-deep px-4 py-2.5 text-sm font-semibold text-bone-light hover:bg-olive-deep/90">Route to buyer</button>
        <button className="flex-1 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">Weigh &amp; log</button>
        <button onClick={reset} className="rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-muted hover:bg-bone-light">Scan next</button>
      </div>
    </Card>
  );
}

/** Mock result: random demo bin (used when the API isn't configured). */
function MockBinResult({ code, reset }: { code: string; reset: () => void }) {
  const stream = streams[Math.floor(Math.random() * streams.length)];
  const weight = (100 + Math.random() * 900).toFixed(0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-edge/60 bg-bone-light/50 p-5">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">{code}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-olive-deep">{stream} bin</h2>
        </div>
        <Badge tone="good">Verified</Badge>
      </div>
      <div className="grid grid-cols-2 gap-px bg-edge/40 sm:grid-cols-4">
        {[
          { k: "weight", v: `${weight} lb` },
          { k: "facility", v: "Plant 01" },
          { k: "cycle", v: "Recovery" },
          { k: "sealed", v: "On chain" },
        ].map((d) => (
          <div key={d.k} className="bg-white p-4">
            <p className="kicker">{d.k}</p>
            <p className="mt-1 font-semibold text-olive-deep">{d.v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 p-5">
        <button className="flex-1 rounded-xl bg-olive-deep px-4 py-2.5 text-sm font-semibold text-bone-light hover:bg-olive-deep/90">Route to buyer</button>
        <button className="flex-1 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">Weigh &amp; log</button>
        <button onClick={reset} className="rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-muted hover:bg-bone-light">Scan next</button>
      </div>
    </Card>
  );
}

export default function BinScannerPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Facility Scanner"
        subtitle="Scan a bin QR code to view its lifecycle and route it."
        icon={<Icon name="scan" width={22} height={22} />}
      />
      <ScanPanel
        title="Scan Bin QR Code"
        subtitle="Point the scanner at a bin tag, or enter the code by hand."
        icon="bin"
        placeholder="Enter bin QR code"
        makeCode={() => (apiConfigured ? "BIN-HEART-001" : "BIN-" + Math.floor(7000 + Math.random() * 999))}
        renderResult={(code, reset) =>
          apiConfigured ? <LiveBinResult code={code} reset={reset} /> : <MockBinResult code={code} reset={reset} />
        }
      />
    </div>
  );
}
