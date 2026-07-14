"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { pillars, type PillarId } from "@/data/pillars";
import { pillarScreens } from "./dashboard/PillarScreens";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/atoms";

export function Pillars() {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState<PillarId>("hardware");
  const active = pillars.find((p) => p.id === activeId)!;
  const ActiveScreen = pillarScreens[activeId];

  return (
    <section id="pillars" className="relative scroll-mt-20 bg-bone-light/50 py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-40" />
      <div className="shell relative">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>The five pillars</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-olive-deep sm:text-[2.7rem]">
              Five connected pillars. One moment on the floor touches them all.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-lg leading-relaxed text-ink/75">
              Each pillar does one job and hands its work to the next. Select a
              pillar to see what it includes and watch its live screen.
            </p>
          </Reveal>
        </div>

        {/* Tabs */}
        <Reveal delay={0.05} className="mt-12">
          <div
            role="tablist"
            aria-label="The five pillars"
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {pillars.map((p) => {
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(p.id)}
                  className={`group relative flex shrink-0 items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "border-olive-deep bg-olive-deep text-canvas"
                      : "border-edge bg-white/70 text-muted hover:border-olive-deep/40 hover:text-olive-deep"
                  }`}
                >
                  <span className={`font-mono text-xs ${isActive ? "text-rust" : "text-edge group-hover:text-rust/70"}`}>
                    {p.index}
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Body */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
          {/* Detail panel */}
          <div className="min-h-[520px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.21, 0.5, 0.27, 1] }}
              >
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-rust">
                  {active.layer}
                </p>
                <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-olive-deep sm:text-3xl">
                  {active.name}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-ink/80">{active.lede}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{active.idea}</p>

                {/* tools */}
                <div className="mt-6 space-y-3">
                  {active.tools.map((tool, i) => (
                    <motion.div
                      key={tool.name}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: 0.05 + i * 0.04 }}
                      className="flex gap-3 rounded-xl border border-edge/60 bg-white/70 p-3.5"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-rust" aria-hidden />
                      <p className="text-sm leading-relaxed text-ink/80">
                        <span className="font-semibold text-olive-deep">{tool.name}. </span>
                        {tool.detail}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* value */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {active.value.map((v) => (
                    <div key={v.label} className="rounded-xl border border-edge/60 bg-canvas p-3">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-rust">{v.label}</p>
                      <p className="mt-1 text-[0.72rem] leading-snug text-muted">{v.detail}</p>
                    </div>
                  ))}
                </div>

                {/* connects */}
                <div className="mt-5 rounded-xl border-l-2 border-olive bg-olive/[0.06] p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-olive">
                    How it connects
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{active.connects}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Screen */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.45, ease: [0.21, 0.5, 0.27, 1] }}
              >
                <ActiveScreen />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
