
import { motion, useReducedMotion } from "motion/react";
import { problem } from "@/data/content";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/atoms";

export function Problem() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-olive-deep py-20 text-bone md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-rust/15 blur-3xl"
      />

      <div className="shell relative">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow tone="rust">{problem.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-bone sm:text-[2.7rem]">
              {problem.heading}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-lg leading-relaxed text-bone-light">{problem.intro}</p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {problem.losses.map((loss, i) => (
            <Reveal key={loss.place} delay={0.1 + i * 0.1}>
              <div className="group h-full rounded-2xl border border-rust/55 bg-white/[0.04] p-6 transition-colors hover:border-bone/90 hover:bg-white/[0.06]">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-sm font-semibold text-rust-light">{`0${i + 1}`}</span>
                  <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-rust-light">
                    Loss
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-bone">{loss.place}</h3>
                <p className="mt-3 text-sm leading-relaxed text-bone-light/90">{loss.detail}</p>
                <p className="mt-5 border-t border-bone/12 pt-4 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-rust-light">
                  {loss.metric}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Root cause */}
        <Reveal delay={0.15} className="mt-12">
          <div className="grid items-center gap-6 rounded-2xl border border-rust/30 bg-rust/[0.07] p-7 md:grid-cols-[auto_1fr] md:p-9">
            <div>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-rust-light">
                {problem.root.label}
              </p>
              <motion.p
                initial={reduce ? false : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mt-2 font-display text-3xl font-extrabold leading-tight text-bone md:text-4xl"
              >
                {problem.root.statement}
              </motion.p>
            </div>
            <p className="text-base leading-relaxed text-bone-light md:border-l md:border-bone/15 md:pl-6">
              {problem.root.detail}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
