"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { trpc, apiConfigured } from "@/lib/trpc";

function nowLocalInput(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
const trimOrUndef = (v: string) => (v.trim() ? v.trim() : undefined);
const numOrUndef = (v: string) => {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const inputCls = "w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none";
const labelCls = "mb-1.5 block text-xs font-semibold text-olive-deep";

export default function NewShipmentPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const facilitiesQ = trpc.shipment.facilityOptions.useQuery(undefined, { enabled: apiConfigured, staleTime: 60_000 });
  const register = trpc.shipment.register.useMutation({
    onSuccess: () => utils.shipment.list.invalidate(),
  });

  const [f, setF] = useState({
    supplier: "",
    reference: "",
    receivedBy: "",
    quantity: "",
    weightKg: "",
    condition: "GOOD",
    conditionNote: "",
    contents: "",
    facilityId: "",
    expectedAt: "",
    receivedAt: nowLocalInput(),
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!apiConfigured) {
      router.push("/shipments");
      return;
    }
    register.mutate({
      supplier: f.supplier.trim(),
      reference: trimOrUndef(f.reference),
      receivedBy: trimOrUndef(f.receivedBy),
      contents: trimOrUndef(f.contents),
      conditionNote: trimOrUndef(f.conditionNote),
      quantity: numOrUndef(f.quantity),
      weightKg: numOrUndef(f.weightKg),
      condition: f.condition === "DAMAGED" ? "DAMAGED" : "GOOD",
      facilityId: f.facilityId || undefined,
      expectedAt: f.expectedAt ? new Date(`${f.expectedAt}T00:00:00`).toISOString() : undefined,
      receivedAt: f.receivedAt ? new Date(f.receivedAt).toISOString() : undefined,
    });
  };

  // ── Confirmation ──
  if (apiConfigured && register.isSuccess && register.data) {
    const s = register.data;
    return (
      <div className="mx-auto max-w-xl py-8 text-center">
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-live/15 text-live">
          <Icon name="check" width={30} height={30} />
        </motion.span>
        <h1 className="mt-5 font-display text-2xl font-extrabold text-olive-deep">Shipment recorded</h1>
        <p className="mt-1 font-mono text-sm text-muted">{s.shipmentCode}</p>
        <Card className="mt-6 overflow-hidden text-left">
          <div className="divide-y divide-edge/50">
            {[
              ["supplier", s.supplier],
              ["facility", s.facilityName ?? "—"],
              ["quantity", s.quantity != null ? String(s.quantity) : "—"],
              ["weight_kg", s.weightKg != null ? String(s.weightKg) : "—"],
              ["condition", s.condition],
              ["received_by", s.receivedBy ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-2.5">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">{k}</span>
                <span className="text-sm font-semibold text-olive-deep">{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/shipments" className="rounded-xl bg-olive-deep px-5 py-2.5 text-sm font-semibold text-bone-light hover:bg-olive-deep/90">View shipments</Link>
          <button onClick={() => register.reset()} className="rounded-xl border border-edge bg-white px-5 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
            Record another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/shipments" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
        <Icon name="arrow" width={14} height={14} className="rotate-180" /> Back to shipments
      </Link>
      <PageHeader title="Record Supplier Shipment" subtitle="Log an inbound delivery as it arrives at the dock." icon={<Icon name="box" width={22} height={22} />} />
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Supplier / vendor <span className="text-rust">*</span></label>
            <input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="e.g. North Plains Ranching" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tracking / PO number</label>
            <input value={f.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. PO-204" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Received by</label>
            <input value={f.receivedBy} onChange={(e) => set("receivedBy", e.target.value)} placeholder="e.g. M. Smith" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Quantity (boxes / items)</label>
            <input value={f.quantity} onChange={(e) => set("quantity", e.target.value)} type="number" placeholder="e.g. 540" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Weight (kg)</label>
            <input value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} type="number" placeholder="e.g. 1200" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Destination facility</label>
            <select value={f.facilityId} onChange={(e) => set("facilityId", e.target.value)} className={inputCls} disabled={!apiConfigured}>
              <option value="">— None —</option>
              {(facilitiesQ.data ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Condition</label>
            <select value={f.condition} onChange={(e) => set("condition", e.target.value)} className={inputCls}>
              <option value="GOOD">Good</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Expected arrival</label>
            <input value={f.expectedAt} onChange={(e) => set("expectedAt", e.target.value)} type="date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Received at</label>
            <input value={f.receivedAt} onChange={(e) => set("receivedAt", e.target.value)} type="datetime-local" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Condition note</label>
            <input value={f.conditionNote} onChange={(e) => set("conditionNote", e.target.value)} placeholder="e.g. Two boxes crushed on arrival" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Contents description</label>
            <textarea value={f.contents} onChange={(e) => set("contents", e.target.value)} rows={2} placeholder="e.g. Fresh hides, boxed" className={inputCls} />
          </div>
        </div>
        {apiConfigured && register.error ? <p className="mt-3 text-sm text-rust">{register.error.message}</p> : null}
        <button
          onClick={submit}
          disabled={!f.supplier.trim() || (apiConfigured && register.isPending)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-olive-deep px-4 py-3 text-sm font-semibold text-bone-light hover:bg-olive-deep/90 disabled:opacity-50"
        >
          <Icon name="check" width={16} height={16} />
          {apiConfigured && register.isPending ? "Recording…" : "Record Shipment"}
        </button>
      </Card>
    </div>
  );
}
