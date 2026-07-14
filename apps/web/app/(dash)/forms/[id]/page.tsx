"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Progress } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { getForm } from "@/lib/api";
import { trpc, apiConfigured } from "@/lib/trpc";

export default function FormFillPage({ params }: { params: { id: string } }) {
  return apiConfigured ? <LiveFormFill id={params.id} /> : <MockFormFill id={params.id} />;
}

/* ────────────────────────── Sealed confirmation ────────────────────────── */
function Sealed({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-live/15 text-live">
        <Icon name="check" width={30} height={30} />
      </motion.span>
      <h1 className="mt-5 font-display text-2xl font-extrabold text-olive-deep">Record submitted</h1>
      <p className="mt-2 text-sm text-muted">{name} was completed and saved to the compliance archive.</p>
      <p className="mt-3 font-mono text-xs text-muted">record_id · NPB-{Math.random().toString(16).slice(2, 8).toUpperCase()}</p>
      <Link href="/forms" className="mt-6 inline-flex rounded-xl border border-edge bg-white px-5 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
        Back to forms
      </Link>
    </div>
  );
}

/* ────────────────────────── Field controls ────────────────────────── */
interface FF {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "radio" | "date" | "time" | "yes_no";
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

function YesNo({ value, set, compact }: { value: string; set: (v: string) => void; compact?: boolean }) {
  const p = compact ? "px-2 py-1 text-[0.7rem]" : "px-4 py-2.5 text-sm";
  return (
    <div className="flex gap-1">
      {["Yes", "No"].map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => set(value === o ? "" : o)}
          className={`${p} flex-1 rounded-lg border font-semibold transition-colors ${
            value === o ? "border-live bg-live/[0.1] text-olive-deep" : "border-edge bg-white text-muted hover:bg-bone-light"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function FieldControl({ field, value, set, compact }: { field: FF; value: string; set: (v: string) => void; compact?: boolean }) {
  const cls = `w-full rounded-xl border bg-white focus:border-rust focus:outline-none ${
    compact ? "px-2 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm"
  } ${value ? "border-live/40" : "border-edge"}`;
  if (field.type === "textarea") return <textarea rows={compact ? 1 : 2} value={value} onChange={(e) => set(e.target.value)} placeholder={field.placeholder ?? ""} className={cls} />;
  if (field.type === "yes_no") return <YesNo value={value} set={set} compact={compact} />;
  if (field.type === "select" || field.type === "radio") {
    return (
      <select value={value} onChange={(e) => set(e.target.value)} className={cls}>
        <option value="">Select…</option>
        {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  const t = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
  return <input type={t} value={value} onChange={(e) => set(e.target.value)} placeholder={field.placeholder ?? ""} className={cls} />;
}

function LabeledField({ field, value, set }: { field: FF; value: string; set: (v: string) => void }) {
  return (
    <div className={field.type === "textarea" ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold text-olive-deep">
        {field.label} {field.required ? <span className="text-rust">*</span> : null}
      </label>
      <FieldControl field={field} value={value} set={set} />
    </div>
  );
}

/* Add-row table (for standard tableColumns + repeating forms) */
function RepeatingTable({
  columns,
  rows,
  onChange,
}: {
  columns: FF[];
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const setCell = (i: number, colId: string, v: string) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r)));
  return (
    <div>
      <div className="scroll-thin overflow-x-auto rounded-xl border border-edge/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge/60 bg-bone-light/50 text-left">
              {columns.map((c) => (
                <th key={c.id} className="whitespace-nowrap px-3 py-2 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">{c.label}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-edge/40 last:border-0">
                {columns.map((c) => (
                  <td key={c.id} className="px-2 py-1.5 align-top">
                    <div className="min-w-[9rem]">
                      <FieldControl field={c} value={row[c.id] ?? ""} set={(v) => setCell(i, c.id, v)} compact />
                    </div>
                  </td>
                ))}
                <td className="px-1 text-center align-middle">
                  {rows.length > 1 ? (
                    <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="text-base leading-none text-muted hover:text-rust" aria-label="Remove row">
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => onChange([...rows, {}])} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-edge bg-white px-3 py-1.5 text-xs font-semibold text-olive-deep hover:bg-bone-light">
        <span className="text-sm leading-none">+</span> Add row
      </button>
    </div>
  );
}

/* ────────────────────────── Live renderer ────────────────────────── */
const sectionVisible = (s: any, values: Record<string, string>) =>
  !s.showIf || (s.showIf.values ?? []).includes(values[s.showIf.fieldId] ?? "");

function visibleScalarIds(schema: any, values: Record<string, string>): string[] {
  const out: string[] = [];
  const push = (fs?: any[]) => fs?.forEach((f) => out.push(f.id));
  switch (schema?.formType) {
    case "standard":
      (schema.sections ?? []).forEach((s: any) => sectionVisible(s, values) && push(s.fields));
      break;
    case "checklist":
      push(schema.headerFields);
      (schema.groups ?? []).forEach((g: any) => (g.items ?? []).forEach((it: any) => out.push(it.id)));
      break;
    case "matrix":
      push(schema.headerFields);
      (schema.rows ?? []).forEach((r: any) => (schema.columns ?? []).forEach((c: any) => out.push(`${r.id}::${c.id}`)));
      push(schema.footerFields);
      break;
  }
  return out;
}

function LiveFormFill({ id }: { id: string }) {
  const q = trpc.form.getById.useQuery({ id }, { retry: false });
  const [values, setValues] = useState<Record<string, string>>({});
  const [tableRows, setTableRows] = useState<Record<string, Record<string, string>[]>>({});
  const [sealed, setSealed] = useState(false);

  const setVal = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const rowsFor = (key: string) => tableRows[key] ?? [{}];
  const setRowsFor = (key: string, r: Record<string, string>[]) => setTableRows((p) => ({ ...p, [key]: r }));

  if (q.isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 py-16">
        <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
        <p className="font-mono text-sm text-muted">Loading form…</p>
      </div>
    );
  }
  if (q.error || !q.data) return notFound();
  if (sealed) return <Sealed name={q.data.title} />;

  const form = q.data;
  const schema: any = form.schema;
  const typeLabel =
    ({ standard: "Multi-Section", checklist: "Checklist", matrix: "Matrix / Grid", repeating: "Repeating Table" } as Record<string, string>)[form.formType] ??
    form.formType;

  const scalarIds = visibleScalarIds(schema, values);
  const scalarFilled = scalarIds.filter((k) => (values[k] ?? "").trim()).length;
  const tableCellsFilled = Object.values(tableRows).flat().reduce((n, row) => n + Object.values(row).filter((v) => String(v ?? "").trim()).length, 0);
  const pct = scalarIds.length > 0 ? Math.round((scalarFilled / scalarIds.length) * 100) : tableCellsFilled > 0 ? 100 : 0;
  const anyFilled = scalarFilled > 0 || tableCellsFilled > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/forms" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
        <Icon name="arrow" width={14} height={14} className="rotate-180" /> Back to forms
      </Link>
      <PageHeader title={form.title} subtitle={form.description ?? ""} actions={<Badge tone="active">{typeLabel}</Badge>} />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {/* ── Standard ── */}
          {schema?.formType === "standard" &&
            (schema.sections ?? []).map((s: any) => {
              if (!sectionVisible(s, values)) return null;
              const hasFields = (s.fields ?? []).length > 0;
              const hasTable = (s.tableColumns ?? []).length > 0;
              if (!hasFields && !hasTable) return null;
              return (
                <Card key={s.id} className="p-5">
                  {s.title ? <h2 className="mb-4 border-b border-edge/60 pb-2 font-display text-base font-bold text-olive-deep">{s.title}</h2> : null}
                  {hasFields ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {s.fields.map((f: FF) => <LabeledField key={f.id} field={f} value={values[f.id] ?? ""} set={(v) => setVal(f.id, v)} />)}
                    </div>
                  ) : null}
                  {hasTable ? <div className={hasFields ? "mt-4" : ""}><RepeatingTable columns={s.tableColumns} rows={rowsFor(s.id)} onChange={(r) => setRowsFor(s.id, r)} /></div> : null}
                </Card>
              );
            })}

          {/* ── Repeating ── */}
          {schema?.formType === "repeating" ? (
            <>
              {schema.instructions ? (
                <Card className="border-rust/30 bg-rust/[0.04] p-5">
                  <p className="mb-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-rust">Instructions</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{schema.instructions}</p>
                </Card>
              ) : null}
              <Card className="p-5">
                <RepeatingTable columns={schema.columns ?? []} rows={rowsFor("__repeating")} onChange={(r) => setRowsFor("__repeating", r)} />
              </Card>
            </>
          ) : null}

          {/* ── Matrix ── */}
          {schema?.formType === "matrix" ? (
            <>
              {(schema.headerFields ?? []).length ? (
                <Card className="p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {schema.headerFields.map((f: FF) => <LabeledField key={f.id} field={f} value={values[f.id] ?? ""} set={(v) => setVal(f.id, v)} />)}
                  </div>
                </Card>
              ) : null}
              <Card className="p-5">
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-edge/60 text-left">
                        <th className="px-3 py-2" />
                        {(schema.columns ?? []).map((c: any) => (
                          <th key={c.id} className="px-3 py-2 text-center font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(schema.rows ?? []).map((r: any) => (
                        <tr key={r.id} className="border-b border-edge/40 last:border-0">
                          <td className="px-3 py-2 text-sm text-ink/85">{r.label}</td>
                          {(schema.columns ?? []).map((c: any) => {
                            const key = `${r.id}::${c.id}`;
                            return (
                              <td key={c.id} className="px-3 py-2">
                                <div className="min-w-[7rem]"><YesNo value={values[key] ?? ""} set={(v) => setVal(key, v)} compact /></div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              {(schema.footerFields ?? []).length ? (
                <Card className="p-5">
                  <div className="grid gap-4">
                    {schema.footerFields.map((f: FF) => <LabeledField key={f.id} field={f} value={values[f.id] ?? ""} set={(v) => setVal(f.id, v)} />)}
                  </div>
                </Card>
              ) : null}
            </>
          ) : null}

          {/* ── Checklist ── */}
          {schema?.formType === "checklist" ? (
            <>
              {(schema.headerFields ?? []).length ? (
                <Card className="p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {schema.headerFields.map((f: FF) => <LabeledField key={f.id} field={f} value={values[f.id] ?? ""} set={(v) => setVal(f.id, v)} />)}
                  </div>
                </Card>
              ) : null}
              {(schema.groups ?? []).map((g: any) => (
                <Card key={g.id} className="p-5">
                  <h2 className="mb-4 border-b border-edge/60 pb-2 font-display text-base font-bold text-olive-deep">{g.title}</h2>
                  <ul className="space-y-3">
                    {(g.items ?? []).map((it: any) => (
                      <li key={it.id} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="flex-1 text-sm text-ink/85">{it.label}</span>
                        <div className="w-32"><YesNo value={values[it.id] ?? ""} set={(v) => setVal(it.id, v)} /></div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </>
          ) : null}

          {scalarIds.length === 0 && schema?.formType !== "repeating" ? (
            <Card className="p-6 text-sm text-muted">This form has no fields defined in its schema yet.</Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="kicker">completion</span>
              <span className="font-mono text-sm font-bold text-olive-deep tnum">{pct}%</span>
            </div>
            <div className="mt-3"><Progress value={pct} /></div>
            <p className="mt-2 text-xs text-muted">
              {scalarIds.length > 0 ? `${scalarFilled} of ${scalarIds.length} fields complete` : `${tableCellsFilled} cells filled`}
            </p>
          </Card>
          <button onClick={() => setSealed(true)} disabled={!anyFilled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50">
            <Icon name="check" width={16} height={16} />
            Submit form
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── Mock (no API) ────────────────────────── */
const sectionsFor = (type: string) =>
  type === "Checklist"
    ? [
        { title: "Inspection items", kind: "check" as const, items: ["Surfaces sanitized", "Instruments calibrated", "Allergen controls verified", "Pest activity none", "Temperature within spec", "Labels accurate"] },
        { title: "Sign off", kind: "field" as const, items: ["Inspector name", "Date", "Notes"] },
      ]
    : [
        { title: "Header", kind: "field" as const, items: ["Establishment", "Date", "Shift", "Recorded by"] },
        { title: "Details", kind: "field" as const, items: ["Lot or batch", "Quantity", "Supplier", "Condition on arrival"] },
        { title: "Verification", kind: "field" as const, items: ["Temperature reading", "Corrective action", "Reviewer"] },
      ];

function MockFormFill({ id }: { id: string }) {
  const form = getForm(id);
  if (!form) return notFound();
  const sections = sectionsFor(form.type);
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  const [filled, setFilled] = useState<Record<string, boolean>>({});
  const [sealed, setSealed] = useState(false);
  const count = Object.values(filled).filter(Boolean).length;
  const pct = Math.round((count / total) * 100);
  const setField = (key: string, on: boolean) => setFilled((f) => ({ ...f, [key]: on }));

  if (sealed) return <Sealed name={form.name} />;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/forms" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
        <Icon name="arrow" width={14} height={14} className="rotate-180" /> Back to forms
      </Link>
      <PageHeader title={form.name} subtitle={form.desc} actions={<Badge tone={form.type === "Checklist" ? "good" : "active"}>{form.type}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {sections.map((s) => (
            <Card key={s.title} className="p-5">
              <h2 className="font-display text-base font-bold text-olive-deep">{s.title}</h2>
              <div className={`mt-4 ${s.kind === "check" ? "space-y-2" : "grid gap-4 sm:grid-cols-2"}`}>
                {s.items.map((it) => {
                  const key = `${s.title}-${it}`;
                  const on = !!filled[key];
                  return s.kind === "check" ? (
                    <button key={it} onClick={() => setField(key, !on)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${on ? "border-live/40 bg-live/[0.07]" : "border-edge bg-white hover:bg-bone-light"}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-live bg-live text-white" : "border-edge"}`}>{on ? <Icon name="check" width={13} height={13} /> : null}</span>
                      <span className={on ? "font-medium text-olive-deep" : "text-ink/80"}>{it}</span>
                    </button>
                  ) : (
                    <div key={it}>
                      <label className="mb-1.5 block text-xs font-semibold text-olive-deep">{it}</label>
                      <input onChange={(e) => setField(key, e.target.value.length > 0)} value={on ? "Captured by voice" : undefined} placeholder={`Enter ${it.toLowerCase()}`} className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none ${on ? "border-live/40" : "border-edge"}`} />
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="kicker">completion</span>
              <span className="font-mono text-sm font-bold text-olive-deep tnum">{pct}%</span>
            </div>
            <div className="mt-3"><Progress value={pct} /></div>
            <p className="mt-2 text-xs text-muted">{count} of {total} fields complete</p>
          </Card>
          <button onClick={() => setSealed(true)} disabled={count === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50">
            <Icon name="check" width={16} height={16} />
            Submit form
          </button>
        </div>
      </div>
    </div>
  );
}
