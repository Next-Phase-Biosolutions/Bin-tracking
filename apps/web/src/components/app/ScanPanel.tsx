
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { CameraScanner } from "./CameraScanner";

type Phase = "idle" | "scanning" | "result";
type Mode = "handheld" | "camera";

export function ScanPanel({
  title,
  subtitle,
  icon = "scan",
  placeholder = "Enter code manually",
  makeCode,
  renderResult,
  enableCamera = true,
}: {
  title: string;
  subtitle: string;
  icon?: string;
  placeholder?: string;
  makeCode: () => string;
  renderResult: (code: string, reset: () => void) => ReactNode;
  enableCamera?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<Mode>("handheld");
  const [code, setCode] = useState("");
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const run = (c: string) => {
    const trimmed = c.trim();
    if (!trimmed) return;
    setCode(trimmed);
    setPhase("scanning");
    window.setTimeout(() => setPhase("result"), mode === "camera" ? 300 : 1500);
  };
  const reset = () => {
    setPhase("idle");
    setManual("");
    setCameraError(null);
  };

  return (
    <div className="mx-auto max-w-lg">
      <AnimatePresence mode="wait">
        {phase !== "result" ? (
          <motion.div
            key="scan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-edge/70 bg-white p-8 shadow-card"
          >
            <div className="flex flex-col items-center text-center">
              {enableCamera ? (
                <div className="mb-6 flex items-center gap-1 rounded-full border border-edge bg-bone-light/60 p-1">
                  {(["handheld", "camera"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setCameraError(null);
                      }}
                      disabled={phase === "scanning"}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                        mode === m ? "bg-olive-deep text-bone-light" : "text-muted hover:text-olive-deep"
                      }`}
                    >
                      {m === "handheld" ? "Handheld / manual" : "Camera"}
                    </button>
                  ))}
                </div>
              ) : null}

              {mode === "camera" && enableCamera && phase === "idle" ? (
                <div className="w-full">
                  <CameraScanner onScan={run} onError={(e) => setCameraError(e)} />
                  {cameraError ? (
                    <p className="mt-3 rounded-lg bg-rust/[0.08] px-3 py-2 text-xs leading-relaxed text-rust">
                      Couldn&apos;t start the camera ({cameraError}). Allow camera permission, or use handheld / manual.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  {/* scan target */}
                  <div className="relative flex h-40 w-40 items-center justify-center rounded-2xl border border-edge bg-bone-light/50">
                    <span aria-hidden className="absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-rust" />
                    <span aria-hidden className="absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-rust" />
                    <span aria-hidden className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-rust" />
                    <span aria-hidden className="absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-rust" />
                    {phase === "scanning" && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-x-3 h-0.5 bg-rust shadow-[0_0_12px_2px_rgba(168,68,42,0.5)]"
                        initial={{ top: "0.75rem" }}
                        animate={{ top: "calc(100% - 0.75rem)" }}
                        transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                      />
                    )}
                    <Icon name={icon} width={46} height={46} className="text-olive-deep/70" />
                  </div>
                  <h2 className="mt-6 font-display text-2xl font-extrabold text-olive-deep">{title}</h2>
                  <p className="mt-2 max-w-xs text-sm text-muted">{phase === "scanning" ? "Scanning…" : subtitle}</p>
                </>
              )}

              <div className="mt-6 h-px w-full bg-edge/60" />

              <div className="mt-6 flex w-full gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run(manual || makeCode())}
                  placeholder={placeholder}
                  className="min-w-0 flex-1 rounded-xl border border-edge bg-white px-4 py-3 text-sm focus:border-rust focus:outline-none"
                />
                <button
                  onClick={() => run(manual || makeCode())}
                  disabled={phase === "scanning"}
                  className="shrink-0 rounded-xl bg-olive px-4 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-olive/90 disabled:opacity-60"
                >
                  {mode === "camera" ? "Look up" : "Scan"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {renderResult(code, reset)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
