
import { useEffect, useRef } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { ScanPanel } from "@/components/app/ScanPanel";
import { trpc, apiConfigured } from "@/lib/trpc";
import { useTimesheet } from "@/lib/live-data";

const names = ["Jordan Doe", "Marisol Smith", "Ade Okafor", "Priya Nair", "Liam Chen"];
const depts = ["Kill Floor", "Processing", "Receiving", "Value Add", "Shipping"];

/** Live badge scan: toggles check-in/out via attendance.scan. */
function LiveScanResult({ code, reset }: { code: string; reset: () => void }) {
  const utils = trpc.useUtils();
  const scan = trpc.attendance.scan.useMutation({
    onSuccess: () => {
      utils.attendance.recent.invalidate();
      utils.attendance.summary.invalidate();
    },
  });
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      scan.mutate({ qrCode: code, source: "Gate A" });
    }
  }, [code, scan]);

  if (scan.isPending || scan.isIdle) {
    return (
      <Card className="flex items-center justify-center gap-3 p-10">
        <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
        <p className="font-mono text-sm text-muted">Reading badge {code}…</p>
      </Card>
    );
  }
  if (scan.error || !scan.data) {
    return (
      <Card className="p-7 text-center">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">{code}</p>
        <h2 className="mt-1 font-display text-xl font-bold text-rust">Badge not recognized</h2>
        <p className="mt-1 text-sm text-muted">No active employee matches this badge.</p>
        <button onClick={reset} className="mt-6 w-full rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
          Scan next badge
        </button>
      </Card>
    );
  }

  const r = scan.data;
  const checkedIn = r.action === "CHECK_IN";
  return (
    <Card className="p-7 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-live/15 text-live">
        <Icon name="check" width={28} height={28} />
      </span>
      <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">{r.employeeCode}</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold text-olive-deep">{r.employeeName}</h2>
      <div className="mt-4">
        <Badge tone={checkedIn ? "good" : "idle"}>{checkedIn ? "Checked in" : "Checked out"} · Gate A</Badge>
      </div>
      <button onClick={reset} className="mt-6 w-full rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
        Scan next badge
      </button>
    </Card>
  );
}

/** Mock badge scan (used when the API isn't configured). */
function MockScanResult({ code, reset }: { code: string; reset: () => void }) {
  const name = names[Math.floor(Math.random() * names.length)];
  const dept = depts[Math.floor(Math.random() * depts.length)];
  const checkIn = Math.random() > 0.5;
  return (
    <Card className="p-7 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-live/15 text-live">
        <Icon name="check" width={28} height={28} />
      </span>
      <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">{code}</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold text-olive-deep">{name}</h2>
      <p className="mt-1 text-sm text-muted">{dept}</p>
      <div className="mt-4">
        <Badge tone={checkIn ? "good" : "idle"}>{checkIn ? "Checked in" : "Checked out"} · Gate A</Badge>
      </div>
      <button onClick={reset} className="mt-6 w-full rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
        Scan next badge
      </button>
    </Card>
  );
}

export default function EmployeeScannerPage() {
  const { scans } = useTimesheet();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Employee Scanner"
        subtitle="Badge check in and check out at the gate."
        icon={<Icon name="badge" width={22} height={22} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <ScanPanel
          title="Scan Badge"
          subtitle="Scan an employee badge to check them in or out."
          icon="badge"
          placeholder="Enter badge ID"
          makeCode={() => (apiConfigured ? "EMPQR-001" : "EMP-" + Math.floor(1000 + Math.random() * 8999))}
          renderResult={(code, reset) =>
            apiConfigured ? <LiveScanResult code={code} reset={reset} /> : <MockScanResult code={code} reset={reset} />
          }
        />

        <Card className="overflow-hidden">
          <div className="border-b border-edge/60 p-5">
            <h2 className="font-display text-lg font-bold text-olive-deep">Recent Gate Scans</h2>
            <p className="mt-1 text-sm text-muted">Live badge activity at the gates.</p>
          </div>
          <ul className="divide-y divide-edge/40">
            {scans.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${s.action === "Check in" ? "bg-live/15 text-live" : "bg-edge/30 text-muted"}`}>
                  <Icon name={s.action === "Check in" ? "arrow" : "logout"} width={16} height={16} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-olive-deep">{s.name}</p>
                  <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">{s.gate} · {s.time}</p>
                </div>
                <Badge tone={s.action === "Check in" ? "good" : "idle"}>{s.action}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
