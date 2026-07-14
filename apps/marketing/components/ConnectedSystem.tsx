"use client";

import { useReducedMotion } from "framer-motion";
import { connected } from "@/data/content";
import { pillars } from "@/data/pillars";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/atoms";

export function ConnectedSystem() {
  const reduce = useReducedMotion();

  return (
    <section
      id="connected"
      className="relative scroll-mt-20 overflow-hidden bg-olive-deep py-20 text-bone md:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rust/10 blur-3xl"
      />

      <div className="shell relative grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Reveal>
            <Eyebrow tone="rust">{connected.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-bone sm:text-[2.7rem]">
              {connected.heading}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-bone-light">{connected.body}</p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {pillars.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full border border-bone/15 bg-white/[0.04] px-3 py-1.5 text-sm text-bone/80"
                >
                  <span className="font-mono text-xs text-rust">{p.index}</span>
                  {p.name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Connected system film */}
        <Reveal delay={0.1}>
          <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 shadow-panel">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay={!reduce}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
            >
              <source src="/connected-system.mp4" type="video/mp4" />
            </video>
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-olive-deep/55 px-2.5 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-rust" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/85">
                The connected core
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
