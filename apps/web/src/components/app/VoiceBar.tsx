
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../ui/Icon";

type Phase = "idle" | "listening" | "captured";

const SAMPLE = {
  transcript: "Tag four oh two, nine hundred pounds, grade triple A, move to wet aging.",
  record: [
    { k: "animal_tag", v: "402" },
    { k: "weight", v: "900 lb" },
    { k: "grade", v: "AAA" },
    { k: "action", v: "Move → Wet Aging" },
  ],
};

export function VoiceBar() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const openVoice = () => {
      setOpen(true);
      start();
    };
    window.addEventListener("np:voice-open", openVoice);
    return () => window.removeEventListener("np:voice-open", openVoice);
  }, []);

  const start = () => {
    setPhase("listening");
    window.setTimeout(() => setPhase("captured"), 2600);
  };

  return (
    <>
      {/* Floating mic */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) start();
        }}
        aria-label="Butcher Talk voice assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-olive-deep text-bone-light shadow-panel transition-transform hover:scale-105"
      >
        <span aria-hidden className="absolute inset-0 rounded-full bg-rust/40 animate-ping-soft" />
        <Icon name="mic" width={22} height={22} className="relative" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.21, 0.5, 0.27, 1] }}
            className="fixed bottom-24 right-5 z-40 w-[22rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-edge bg-white shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-edge/70 bg-olive-deep px-4 py-3 text-bone-light">
              <div className="flex items-center gap-2">
                <Icon name="mic" width={16} height={16} className="text-rust-light" />
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">Butcher Talk</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-bone/60 hover:text-bone-light" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="p-4">
              {phase === "listening" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-10 items-end gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 origin-bottom rounded-full bg-olive animate-bar-eq"
                        style={{ height: "100%", animationDelay: `${i * 0.09}s` }}
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted">Listening for intent…</p>
                </div>
              )}

              {phase === "captured" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-edge/70 bg-bone-light/60 p-3">
                    <p className="kicker mb-1">transcript</p>
                    <p className="text-sm leading-relaxed text-ink/80">“{SAMPLE.transcript}”</p>
                  </div>
                  <div className="rounded-xl border border-live/30 bg-live/[0.07] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon name="check" width={14} height={14} className="text-live" />
                      <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-live">clean record created</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2">
                      {SAMPLE.record.map((r) => (
                        <div key={r.k} className="rounded-lg bg-white px-2.5 py-1.5">
                          <dt className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted">{r.k}</dt>
                          <dd className="text-sm font-semibold text-olive-deep">{r.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <button
                    onClick={start}
                    className="w-full rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep transition-colors hover:bg-bone-light"
                  >
                    Capture another
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
