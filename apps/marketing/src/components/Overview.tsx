
import { motion, useReducedMotion } from "motion/react";
import { overview } from "@/data/content";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/atoms";

const lifecycle = [
  "Intake",
  "Slaughter",
  "Aging",
  "Grading",
  "Processing",
  "Delivery",
];

export function Overview() {
  const reduce = useReducedMotion();

  return (
    <section id="overview" className="relative scroll-mt-24 py-20 md:py-28">
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Reveal>
              <Eyebrow>{overview.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-olive-deep sm:text-[2.7rem]">
                {overview.heading}
              </h2>
            </Reveal>
          </div>
          <div className="space-y-5 lg:pt-2">
            {overview.paragraphs.map((p, i) => (
              <Reveal key={i} delay={0.1 + i * 0.08}>
                <p className="text-lg leading-relaxed text-ink/85">{p}</p>
              </Reveal>
            ))}
            <Reveal delay={0.3}>
              <p className="border-l-2 border-rust pl-4 font-display text-xl font-bold leading-snug text-olive-deep">
                One connected platform, with nothing left on the table.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Digital thread: the lifecycle passport, over the animal's real journey */}
        <Reveal delay={0.1} className="mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-panel">
            {/* looping footage of an animal travelling through the facility */}
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              autoPlay={!reduce}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
            >
              <source src="/lifecycle-passport.mp4" type="video/mp4" />
            </video>
            {/* warm scrim so the thread and labels stay legible */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-olive-deep/55" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-olive-deep/85 via-olive-deep/35 to-olive-deep/85"
            />
            <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-40" />

            <div className="relative p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/70">
                  The digital lifecycle passport · one animal, end to end
                </p>
                <p className="font-mono text-[0.66rem] text-bone/60">
                  searchable by tag number
                </p>
              </div>
              <div className="relative mt-7">
                {/* the thread line */}
                <div aria-hidden className="absolute left-0 right-0 top-[7px] h-0.5 bg-bone/25" />
                <motion.div
                  aria-hidden
                  className="absolute left-0 top-[7px] h-0.5 origin-left bg-rust"
                  initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.3, ease: "easeInOut" as const }}
                  style={{ right: 0 }}
                />
                <div className="relative grid grid-cols-3 gap-y-7 sm:grid-cols-6">
                  {lifecycle.map((stage, i) => (
                    <motion.div
                      key={stage}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.2 + i * 0.12 }}
                      className="flex flex-col items-center text-center"
                    >
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-rust bg-olive-deep" />
                      <span className="mt-3 text-xs font-semibold text-bone">{stage}</span>
                      <span className="font-mono text-[0.6rem] text-bone/55">{`0${i + 1}`}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
