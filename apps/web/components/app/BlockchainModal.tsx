"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { trpc, apiConfigured } from "@/lib/trpc";

const STEPS = ["Connect", "Review", "Sign", "Done"] as const;

function Wallet({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v1H5a2 2 0 00-2 2V7z" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="8" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="13.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function BlockchainModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [walletFound, setWalletFound] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const txHash = "0x" + "8f3ad2c91b7e4a6052d1c8f0b934ae71".slice(0, 24);

  // Real batch data for the Review step (loaded once the modal opens).
  const summary = trpc.blockchain.getDailySummary.useQuery(
    { fromDate: today, toDate: today },
    { enabled: apiConfigured && open, retry: false },
  );
  const batch = apiConfigured ? summary.data : undefined;
  const reviewRows: [string, string][] = batch
    ? [
        ["operations", `${batch.totalCycles} cycle${batch.totalCycles === 1 ? "" : "s"}`],
        ["range", batch.rangeLabel],
        ["compliance", `${batch.stats?.compliance_rate ?? "100.0"}%`],
        ["network", "Cardano Preprod"],
      ]
    : [
        ["operations", "38 bins · 6 zones"],
        ["forms_sealed", "12 compliance records"],
        ["compliance", "100%"],
        ["network", "Cardano Preprod"],
      ];

  useEffect(() => {
    const onOpen = () => {
      setStep(0);
      setWalletFound(false);
      setOpen(true);
    };
    window.addEventListener("np:blockchain-open", onOpen);
    return () => window.removeEventListener("np:blockchain-open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Simulate the on-chain signing once the user reaches the Sign step.
  useEffect(() => {
    if (open && step === 2) {
      const t = setTimeout(() => setStep(3), 1900);
      return () => clearTimeout(t);
    }
  }, [open, step]);

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Post on Blockchain"
        >
          <div className="absolute inset-0 bg-olive-deep/80 backdrop-blur-sm" />
          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-panel"
            initial={{ scale: 0.95, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.21, 0.5, 0.27, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — brand gradient (replaces the demo's purple) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-olive-deep via-olive-deep to-olive px-6 py-5 text-bone-light">
              <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-50" />
              <button
                onClick={close}
                aria-label="Close"
                className="absolute right-4 top-4 text-bone/70 transition-colors hover:text-bone-light"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
              <p className="relative font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-bone/70">
                Cardano Blockchain
              </p>
              <h2 className="relative mt-1 font-display text-2xl font-extrabold">Post on Blockchain</h2>
              <p className="relative mt-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-bone/65">
                preprod · {today}
              </p>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1 border-b border-edge/60 px-5 py-4">
              {STEPS.map((label, i) => (
                <div key={label} className="flex flex-1 items-center gap-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold transition-colors ${
                        i < step
                          ? "bg-olive text-bone-light"
                          : i === step
                            ? "bg-rust text-canvas"
                            : "border border-edge bg-white text-muted"
                      }`}
                    >
                      {i < step ? "✓" : i + 1}
                    </span>
                    <span className={`text-xs font-semibold ${i === step ? "text-olive-deep" : "text-muted"}`}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-olive" : "bg-edge/60"}`} />}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="p-6">
              {step === 0 && (
                <>
                  <p className="text-sm leading-relaxed text-ink/80">
                    Connect your Cardano wallet to sign and post today&apos;s operations as an immutable
                    NFT on the <span className="font-semibold text-olive-deep">Preprod</span> network.
                  </p>
                  <div className="mt-5 rounded-xl border border-edge bg-bone-light/60 p-5 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rust/12 text-rust">
                      <Wallet />
                    </span>
                    {walletFound ? (
                      <>
                        <p className="mt-3 text-sm font-bold text-olive-deep">Demo Wallet detected</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">Lace (preprod) · addr1qx…7k2p</p>
                        <button
                          onClick={() => setStep(1)}
                          className="mt-4 w-full rounded-xl bg-olive-deep px-4 py-2.5 text-sm font-semibold text-bone-light transition-colors hover:bg-olive-deep/90"
                        >
                          Connect wallet
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm font-bold text-olive-deep">No Cardano wallet detected</p>
                        <p className="mt-1 text-xs leading-relaxed text-rust">
                          Install a CIP-30 wallet extension (Eternl, Nami, or Lace) then refresh the page.
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-4 text-sm font-medium">
                          <a
                            href="https://www.lace.io"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-rust underline-offset-4 hover:underline"
                          >
                            Get Lace
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M5 11l6-6m0 0H6m5 0v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </a>
                          <button onClick={() => setWalletFound(true)} className="text-muted underline-offset-4 hover:text-olive-deep hover:underline">
                            Refresh list
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <p className="text-sm leading-relaxed text-ink/80">
                    Review the batch that will be anchored on-chain for <span className="font-semibold text-olive-deep">{today}</span>.
                  </p>
                  <div className="mt-4 divide-y divide-edge/50 rounded-xl border border-edge/60">
                    {reviewRows.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-4 py-2.5">
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">{k}</span>
                        <span className="text-sm font-semibold text-olive-deep">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => setStep(0)} className="flex-1 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-muted hover:bg-bone-light">Back</button>
                    <button onClick={() => setStep(2)} className="flex-[2] rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-rust/90">Sign &amp; post</button>
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="py-6 text-center">
                  <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-2 border-edge border-t-rust" />
                  <p className="mt-4 text-sm font-semibold text-olive-deep">Signing transaction…</p>
                  <p className="mt-1 text-xs text-muted">Confirm in your wallet to anchor the batch.</p>
                </div>
              )}

              {step === 3 && (
                <div className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-live/15 text-live">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <h3 className="mt-3 font-display text-xl font-extrabold text-olive-deep">Posted to Preprod</h3>
                  <p className="mt-1 text-sm text-muted">Today&apos;s operations are now an immutable NFT.</p>
                  <div className="mt-4 rounded-xl border border-edge/60 bg-bone-light/50 p-3">
                    <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{batch?.merkleRoot ? "merkle_root" : "tx_hash"}</p>
                    <p className="mt-1 break-all font-mono text-xs text-olive-deep">{batch?.merkleRoot ?? txHash}</p>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <a href="https://preprod.cardanoscan.io" target="_blank" rel="noreferrer" className="flex-1 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">View on explorer</a>
                    <button onClick={close} className="flex-1 rounded-xl bg-olive-deep px-4 py-2.5 text-sm font-semibold text-bone-light hover:bg-olive-deep/90">Done</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
