"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { trpc, apiConfigured } from "@/lib/trpc";

export default function FormImportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/forms" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
        <Icon name="arrow" width={14} height={14} className="rotate-180" /> Back to forms
      </Link>
      <PageHeader
        title="Create from Photo"
        subtitle="Photograph any paper form and the AI turns it into a structured digital record."
        icon={<Icon name="camera" width={22} height={22} />}
      />
      {apiConfigured ? <LiveFormImport /> : <MockFormImport />}
    </div>
  );
}

const STAGES = ["RECEIVING", "PROCESSING", "QUALITY", "MAINTENANCE", "SHIPPING", "ALL"];

/** Flatten any digitized schema into a flat list of field labels for the review screen. */
function draftFieldLabels(schema: any): string[] {
  if (!schema || typeof schema !== "object") return [];
  switch (schema.formType) {
    case "standard":
      return (schema.sections ?? []).flatMap((s: any) => (s.fields ?? []).map((f: any) => f.label));
    case "checklist":
      return [
        ...(schema.headerFields ?? []).map((f: any) => f.label),
        ...(schema.groups ?? []).flatMap((g: any) => (g.items ?? []).map((i: any) => i.label)),
      ];
    case "matrix":
      return [
        ...(schema.headerFields ?? []).map((f: any) => f.label),
        ...(schema.rows ?? []).map((r: any) => r.label),
      ];
    case "repeating":
      return (schema.columns ?? []).map((c: any) => c.label);
    default:
      return Array.isArray(schema.fields) ? schema.fields.map((f: any) => f.label) : [];
  }
}

function LiveFormImport() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const digitize = trpc.form.digitizeFromPhoto.useMutation();
  const create = trpc.form.create.useMutation({
    onSuccess: () => {
      utils.form.adminList.invalidate();
      router.push("/forms");
    },
  });

  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState("RECEIVING");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const draft = digitize.data;
  useEffect(() => {
    if (draft?.title) setTitle(draft.title);
  }, [draft]);

  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  };
  useEffect(() => () => stopCam(), []);
  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [camOn]);

  const startCam = async () => {
    setCamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Camera not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamOn(true);
    } catch {
      setCamError("Camera permission blocked. Allow it, or upload an image instead.");
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCam();
    digitize.mutate({ imageBase64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const d = String(reader.result);
      digitize.mutate({ imageBase64: d.split(",")[1] ?? "", mimeType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  };

  // ── Review + save the extracted draft ──
  if (draft) {
    const labels = draftFieldLabels(draft.schema);
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-edge/60 bg-bone-light/50 p-5">
            <div className="flex items-center gap-2">
              <Icon name="check" width={18} height={18} className="text-live" />
              <h2 className="font-display text-lg font-bold text-olive-deep">Form extracted</h2>
            </div>
            <Badge tone="good">{labels.length} fields</Badge>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-olive-deep">Form title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-olive-deep">Stage</label>
                <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none">
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="active">{draft.formType}</Badge>
              {draft.description ? <span className="text-sm text-muted">{draft.description}</span> : null}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {labels.map((l, i) => (
                <li key={`${l}-${i}`} className="rounded-lg bg-bone-light px-2.5 py-1 font-mono text-[0.62rem] text-olive-deep">{l}</li>
              ))}
            </ul>
          </div>
          {create.error ? <p className="px-5 pb-2 text-sm text-rust">{create.error.message}</p> : null}
          <div className="flex gap-2 border-t border-edge/60 p-5">
            <button
              onClick={() =>
                create.mutate({
                  title,
                  description: draft.description ?? null,
                  stage,
                  formType: draft.formType,
                  schema: draft.schema,
                  triggerType: "manual",
                  fillFrequency: "as_needed",
                })
              }
              disabled={!title || create.isPending}
              className="flex-1 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-rust/90 disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : "Save digital form"}
            </button>
            <button onClick={() => digitize.reset()} className="rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
              Import another
            </button>
          </div>
        </Card>
      </motion.div>
    );
  }

  // ── Capture / upload ──
  return (
    <Card className="p-6">
      {digitize.isPending ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-edge border-t-rust" />
          <p className="font-display text-lg font-bold text-olive-deep">Reading the form…</p>
          <p className="text-sm text-muted">Extracting fields with vision AI</p>
        </div>
      ) : camOn ? (
        <div className="flex flex-col items-center gap-4">
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-md rounded-2xl border border-edge bg-black/5" />
          <div className="flex gap-2">
            <button onClick={capture} className="rounded-xl bg-rust px-5 py-2.5 text-sm font-semibold text-canvas hover:bg-rust/90">
              Capture photo
            </button>
            <button onClick={stopCam} className="rounded-xl border border-edge bg-white px-5 py-2.5 text-sm font-semibold text-muted hover:bg-bone-light">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={startCam}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-edge bg-bone-light/40 px-6 py-10 text-center transition-colors hover:border-rust/50 hover:bg-bone-light/70"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-olive-deep shadow-card">
              <Icon name="camera" width={28} height={28} />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-olive-deep">Use camera</p>
              <p className="mt-1 text-sm text-muted">Photograph a paper form with your webcam</p>
            </div>
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-edge bg-white px-4 py-3 text-sm font-semibold text-olive-deep hover:bg-bone-light">
            <Icon name="upload" width={16} height={16} />
            Or upload an image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {camError ? <p className="rounded-lg bg-rust/[0.08] px-3 py-2 text-xs text-rust">{camError}</p> : null}
          {digitize.error ? <p className="rounded-lg bg-rust/[0.08] px-3 py-2 text-xs text-rust">{digitize.error.message}</p> : null}
        </div>
      )}
    </Card>
  );
}

/* ── Mock (no API): the original demo flow ── */
const extracted = [
  { field: "Establishment", value: "Plant 01 — Great Lakes" },
  { field: "Date", value: "4 Jun 2026" },
  { field: "Product", value: "Beef trim, boxed" },
  { field: "Lot number", value: "LOT-88" },
  { field: "Temperature", value: "2.4 °C" },
  { field: "Condition", value: "Good" },
  { field: "Inspector", value: "M. Smith" },
];

function MockFormImport() {
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const start = () => {
    setPhase("processing");
    window.setTimeout(() => setPhase("done"), 2200);
  };

  return phase !== "done" ? (
    <Card className="p-8">
      <button
        onClick={start}
        disabled={phase === "processing"}
        className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-edge bg-bone-light/40 px-6 py-14 text-center transition-colors hover:border-rust/50 hover:bg-bone-light/70 disabled:cursor-wait"
      >
        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-olive-deep shadow-card">
          {phase === "processing" && (
            <motion.span
              aria-hidden
              className="absolute inset-x-2 h-0.5 bg-rust shadow-[0_0_12px_2px_rgba(168,68,42,0.5)]"
              initial={{ top: "0.5rem" }}
              animate={{ top: "calc(100% - 0.5rem)" }}
              transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse" }}
            />
          )}
          <Icon name="upload" width={28} height={28} />
        </span>
        <div>
          <p className="font-display text-lg font-bold text-olive-deep">{phase === "processing" ? "Reading the form…" : "Upload image"}</p>
          <p className="mt-1 text-sm text-muted">{phase === "processing" ? "Extracting fields with vision AI" : "PNG, JPG, or a phone photo of a paper form"}</p>
        </div>
      </button>
    </Card>
  ) : (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-edge/60 bg-bone-light/50 p-5">
          <div className="flex items-center gap-2">
            <Icon name="check" width={18} height={18} className="text-live" />
            <h2 className="font-display text-lg font-bold text-olive-deep">Form extracted</h2>
          </div>
          <Badge tone="good">{extracted.length} fields</Badge>
        </div>
        <dl className="divide-y divide-edge/40">
          {extracted.map((e, i) => (
            <motion.div key={e.field} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">{e.field}</dt>
              <dd className="text-sm font-semibold text-olive-deep">{e.value}</dd>
            </motion.div>
          ))}
        </dl>
        <div className="flex gap-2 border-t border-edge/60 p-5">
          <button className="flex-1 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-rust/90">Save digital form</button>
          <button onClick={() => setPhase("idle")} className="rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
            Import another
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
