"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Stat, Button, Reveal } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useShipments } from "@/lib/live-data";

export default function ShipmentsPage() {
  const rows = useShipments();
  const totalItems = rows.reduce((n, r) => n + r.qty, 0);
  const damaged = rows.filter((r) => r.condition !== "Good").length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Supplier Shipments"
        subtitle="Inbound packages recorded on arrival."
        icon={<Icon name="box" width={22} height={22} />}
        actions={
          <Link href="/shipments/new">
            <Button variant="primary">
              <Icon name="box" width={15} height={15} />
              Record Shipment
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Reveal><Stat label="total_shipments" value={rows.length} icon={<Icon name="box" width={18} height={18} />} /></Reveal>
        <Reveal delay={0.05}><Stat label="total_items" value={totalItems.toLocaleString()} icon={<Icon name="bin" width={18} height={18} />} /></Reveal>
        <Reveal delay={0.1}><Stat label="damaged" value={damaged} accent={damaged > 0} icon={<Icon name="bolt" width={18} height={18} />} /></Reveal>
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-edge/60 p-5">
            <h2 className="font-display text-lg font-bold text-olive-deep">All shipments</h2>
            <button className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
              <Icon name="refresh" width={14} height={14} /> Refresh
            </button>
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left">
                  {["shipment", "supplier", "facility", "qty", "received", "condition"].map((h) => (
                    <th key={h} className="px-5 py-3 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-edge/40 last:border-0 hover:bg-bone-light/40">
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-olive-deep">{r.id}</p>
                      <p className="font-mono text-[0.62rem] text-muted">{r.ref}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-ink">{r.supplier}</td>
                    <td className="px-5 py-3 text-muted">{r.facility}</td>
                    <td className="px-5 py-3 font-semibold text-olive-deep tnum">{r.qty.toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">{r.received}</td>
                    <td className="px-5 py-3"><Badge tone={r.condition === "Good" ? "good" : "alert"}>{r.condition}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
