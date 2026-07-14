"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useIncrement, useTicker } from "@/lib/hooks";
import { Screen, Bar, LiveDot } from "./primitives";
import { GasNode } from "./GasNode";
import { RadialGauge } from "./RadialGauge";

function LiveCount({
  start,
  step,
  intervalMs,
  format,
}: {
  start: number;
  step: number;
  intervalMs: number;
  format: (n: number) => string;
}) {
  const value = useIncrement({ start, step, intervalMs });
  return <>{format(value)}</>;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.21, 0.5, 0.27, 1] } },
};

export function HeroDashboard() {
  const reduce = useReducedMotion();
  const yieldValue = useTicker({ base: 92.4, amplitude: 0.6, decimals: 1, intervalMs: 2200 });

  return (
    <motion.div
      variants={reduce ? undefined : container}
      initial={reduce ? false : "hidden"}
      animate={reduce ? false : "show"}
      className="relative"
    >
      <Screen title="NextPhase · Facility Control" badge="Live">
        {/* KPI row */}
        <motion.div variants={reduce ? undefined : item} className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-edge/70 bg-bone-light/40 p-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
              Bins tracked
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-olive-deep">
              <LiveCount
                start={1284}
                step={1}
                intervalMs={2400}
                format={(n) => n.toLocaleString("en-US")}
              />
            </p>
            <p className="text-[0.62rem] text-muted">today, all streams</p>
          </div>
          <div className="rounded-xl border border-edge/70 bg-bone-light/40 p-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
              Carbon credits
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-rust">
              <LiveCount
                start={418}
                step={1}
                intervalMs={3200}
                format={(n) => `${n.toLocaleString("en-US")}t`}
              />
            </p>
            <p className="text-[0.62rem] text-muted">verified, CO2e</p>
          </div>
          <div className="rounded-xl border border-edge/70 bg-bone-light/40 p-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
              Recovered value
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-olive-deep">
              $
              <LiveCount
                start={61420}
                step={140}
                intervalMs={2800}
                format={(n) => n.toLocaleString("en-US")}
              />
            </p>
            <p className="text-[0.62rem] text-muted">byproduct, this week</p>
          </div>
        </motion.div>

        {/* Gas node + gauge */}
        <motion.div
          variants={reduce ? undefined : item}
          className="mt-3 grid gap-3 sm:grid-cols-[1.6fr_1fr]"
        >
          <div className="rounded-xl border border-edge/70 bg-white p-3.5">
            <GasNode />
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-edge/70 bg-bone-light/40 p-3">
            <RadialGauge value={98.6} label="Compliance" />
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-olive">
              <LiveDot />
              Audit ready
            </div>
          </div>
        </motion.div>

        {/* Yield vs spec */}
        <motion.div
          variants={reduce ? undefined : item}
          className="mt-3 rounded-xl border border-edge/70 bg-white p-3.5"
        >
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted">
              Vision yield vs spec · line 2
            </p>
            <span className="font-mono text-sm font-semibold tabular-nums text-olive-deep">
              {yieldValue.toFixed(1)}%
            </span>
          </div>
          <div className="relative mt-3">
            <Bar value={yieldValue} max={100} tone="olive" />
            {/* spec target marker */}
            <div
              className="absolute -top-1 h-3.5 w-0.5 bg-rust"
              style={{ left: "90%" }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[0.6rem] text-muted">
            <span>0%</span>
            <span className="text-rust">spec 90.0%</span>
            <span>100%</span>
          </div>
        </motion.div>
      </Screen>

      {/* Floating alert chip */}
      {!reduce && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="absolute -bottom-5 -left-4 hidden items-center gap-2.5 rounded-xl border border-edge bg-white px-3.5 py-2.5 shadow-panel-sm sm:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rust/12 text-rust">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v9m0 0l3-3m-3 3L5 7M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-[0.7rem] font-semibold text-olive-deep">Butcher Talk captured</p>
            <p className="font-mono text-[0.62rem] text-muted">Tag 402 · 900 lb · Grade AAA</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
