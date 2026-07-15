
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { getLifecycleStages } from "@/lib/api";
import { trpc, apiConfigured } from "@/lib/trpc";

const fields = [
  { key: "type", label: "Animal Type", required: true, sample: "Beef cattle" },
  { key: "breed", label: "Breed", required: false, sample: "Angus" },
  { key: "age", label: "Age", required: false, sample: "26 months" },
  { key: "weight", label: "Weight", required: false, sample: "1,310 lb" },
  { key: "owner", label: "Owner Name", required: true, sample: "Heritage Valley Farms" },
  { key: "health", label: "Health Condition", required: false, sample: "Healthy, vaccinated" },
];

type AudioMime = "audio/webm" | "audio/mp4";
function pickMime(): AudioMime | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return null;
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function AnimalRegistrationPage() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [mockDone, setMockDone] = useState(false);
  const [mockTag, setMockTag] = useState("");
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const stages = getLifecycleStages();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const register = trpc.farmer.register.useMutation();
  const transcribe = trpc.farmer.transcribe.useMutation({
    onSuccess: (data) => {
      const f = data.fields as Record<string, string | null>;
      setVals((v) => ({
        ...v,
        type: f.animalType ?? v.type ?? "",
        breed: f.breed ?? v.breed ?? "",
        age: f.age ?? v.age ?? "",
        weight: f.weight ?? v.weight ?? "",
        owner: f.ownerName ?? v.owner ?? "",
        health: f.healthCondition ?? v.health ?? "",
      }));
      setTranscript(data.transcript ?? "");
    },
    onError: (e) => setVoiceError(e.message),
  });

  // ── Voice capture ──
  const startMockFill = () => {
    setRecording(true);
    window.setTimeout(() => {
      const next: Record<string, string> = {};
      fields.forEach((f) => (next[f.key] = f.sample));
      setVals(next);
      setRecording(false);
    }, 2400);
  };

  const startRecording = async () => {
    setVoiceError(null);
    if (!apiConfigured) return startMockFill();
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Voice capture isn't supported on this device. Type the details in manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const audioBase64 = await blobToBase64(blob);
        if (audioBase64) transcribe.mutate({ audioBase64, mimeType: mime });
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setVoiceError("Microphone access was blocked. Allow mic permission or type the details in.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const onMicClick = () => (recording ? stopRecording() : startRecording());

  // ── Submit ──
  const submit = () => {
    if (apiConfigured) {
      register.mutate({
        animalType: vals.type,
        breed: vals.breed || undefined,
        age: vals.age || undefined,
        weight: vals.weight || undefined,
        ownerName: vals.owner,
        healthCondition: vals.health || undefined,
        rawTranscript: transcript || undefined,
      });
    } else {
      setMockTag("AN-" + Math.floor(1000 + Math.random() * 8999));
      setMockDone(true);
    }
  };
  const reset = () => {
    if (apiConfigured) register.reset();
    setMockDone(false);
    setVals({});
    setTranscript("");
  };

  const done = apiConfigured ? register.isSuccess : mockDone;
  const transcribing = transcribe.isPending;
  const submitting = apiConfigured && register.isPending;

  if (done) {
    const tag = register.data?.id ? "AN-" + register.data.id.slice(-6).toUpperCase() : mockTag;
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-live/15 text-live">
          <Icon name="check" width={30} height={30} />
        </motion.span>
        <h1 className="mt-5 font-display text-2xl font-extrabold text-olive-deep">Animal registered</h1>
        <p className="mt-1 font-mono text-sm text-muted">Tag {tag} · digital lifecycle passport opened</p>
        <Card className="mt-7 p-6 text-left">
          <p className="kicker mb-5">lifecycle_passport · intake → delivery</p>
          <div className="relative grid grid-cols-3 gap-y-6 sm:grid-cols-6">
            <div aria-hidden className="absolute left-0 right-0 top-[6px] hidden h-0.5 bg-edge sm:block" />
            {stages.map((s, i) => (
              <div key={s} className="relative flex flex-col items-center text-center">
                <span className={`h-3.5 w-3.5 rounded-full border-2 ${i === 0 ? "border-rust bg-rust" : "border-rust bg-canvas"}`} />
                <span className="mt-2 text-xs font-semibold text-olive-deep">{s}</span>
                <span className="font-mono text-[0.55rem] text-muted">{`0${i + 1}`}</span>
              </div>
            ))}
          </div>
        </Card>
        <button onClick={reset} className="mt-6 inline-flex rounded-xl border border-edge bg-white px-5 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
          Register another
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Farmer Animal Registration"
        subtitle="Record your answers by voice and the form fills itself."
        icon={<Icon name="cow" width={22} height={22} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-olive-deep">Animal Details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.key === "health" ? "sm:col-span-2" : ""}>
                <label className="mb-1.5 block text-xs font-semibold text-olive-deep">
                  {f.label} {f.required ? <span className="text-rust">*</span> : null}
                </label>
                <input
                  value={vals[f.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={`Enter ${f.label.toLowerCase()}`}
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none ${vals[f.key] ? "border-live/40" : "border-edge"}`}
                />
              </div>
            ))}
          </div>
          {apiConfigured && register.error ? (
            <p className="mt-3 text-sm text-rust">{register.error.message}</p>
          ) : null}
          <button
            onClick={submit}
            disabled={!vals.type || !vals.owner || submitting}
            className="mt-6 w-full rounded-xl bg-olive-deep px-4 py-3 text-sm font-semibold text-bone-light transition-colors hover:bg-olive-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Registration"}
          </button>
        </Card>

        <Card className="h-fit p-6">
          <p className="kicker">voice_recording</p>
          <p className="mt-2 text-sm text-muted">Speak all your animal details in one go.</p>
          <button
            onClick={onMicClick}
            disabled={transcribing}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-70"
          >
            <Icon name="mic" width={16} height={16} />
            {transcribing ? "Transcribing…" : recording ? "Stop Recording" : "Start Recording"}
          </button>
          {recording && (
            <div className="mt-5 flex h-8 items-end justify-center gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span key={i} className="w-1.5 origin-bottom rounded-full bg-olive animate-bar-eq" style={{ height: "100%", animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          )}
          {voiceError && (
            <p className="mt-4 rounded-lg bg-rust/[0.08] px-3 py-2 text-xs leading-relaxed text-rust">{voiceError}</p>
          )}
          {!recording && !transcribing && !voiceError && Object.keys(vals).length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-live/[0.08] px-3 py-2">
              <Icon name="check" width={14} height={14} className="text-live" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-live">Form filled from voice</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
