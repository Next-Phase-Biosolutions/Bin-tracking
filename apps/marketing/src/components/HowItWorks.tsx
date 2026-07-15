
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { steps } from "@/data/content";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/atoms";
import { LiveDot } from "./dashboard/primitives";
import { EmissionsJourney } from "./dashboard/EmissionsJourney";
import { Lightbox, type ZoomItem } from "./ui/Lightbox";

type Media =
  | { type: "image"; src: string; alt: string }
  | { type: "emissions" };

const media: Media[] = [
  { type: "image", src: "/app-wetaging.png", alt: "Wet Aging Zone facility dashboard" },
  { type: "emissions" },
  { type: "image", src: "/app-forms.png", alt: "Compliance forms ready to fill" },
  { type: "image", src: "/app-valueadd.png", alt: "Value Add Zone facility dashboard" },
];

/* ---- compact coded animation, shown small as an accent over the screenshot ---- */
function StepVisual({ index }: { index: number }) {
  const reduce = useReducedMotion();
  const float = reduce ? {} : { animate: { y: [0, -5, 0] }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const } };

  if (index === 0) {
    return (
      <div className="grid h-full grid-cols-4 items-end gap-3">
        {["Camera", "Scale", "Sensor", "Voice"].map((n, i) => (
          <motion.div key={n} {...float} transition={{ ...(float as any).transition, delay: i * 0.3 }} className="flex flex-col items-center gap-2">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-bone/50">{n}</span>
            <div className="flex h-24 w-full items-end justify-center rounded-lg border border-bone/15 bg-white/[0.04] p-2">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((b) => (
                  <motion.span
                    key={b}
                    className="w-1.5 rounded-full bg-olive"
                    initial={{ height: 8 }}
                    animate={reduce ? { height: 16 } : { height: [8, 22, 12, 8] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: b * 0.2 + i * 0.15 }}
                  />
                ))}
              </div>
            </div>
            <LiveDot />
          </motion.div>
        ))}
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <motion.div {...float} className="w-full max-w-xs rounded-xl border border-bone/15 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-bone/55">HACCP record</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-olive/20 text-olive">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 5V4a3 3 0 016 0v1m-7 0h8v6H2z" stroke="currentColor" strokeWidth="1.1"/></svg>
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-3/4 rounded bg-bone/20" />
            <div className="h-1.5 w-1/2 rounded bg-bone/15" />
          </div>
          <p className="mt-3 break-all font-mono text-[0.58rem] text-olive">0x7b3f…a921 · sealed</p>
        </motion.div>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-bone/45">anchored on blockchain</span>
      </div>
    );
  }

  // index 3 — Revenue: waste -> two streams
  return (
    <div className="flex h-full items-center justify-center gap-4">
      <motion.div {...float} className="rounded-xl border border-bone/15 bg-white/[0.04] px-4 py-6 text-center">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-bone/50">byproduct</p>
        <p className="mt-1 text-2xl">↻</p>
      </motion.div>
      <div className="text-bone/40">→</div>
      <div className="space-y-3">
        <div className="rounded-lg border border-olive/30 bg-olive/10 px-4 py-3 text-center">
          <p className="font-display text-lg font-extrabold text-bone">$1,758</p>
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-olive">byproduct sale</p>
        </div>
        <div className="rounded-lg border border-rust/30 bg-rust/10 px-4 py-3 text-center">
          <p className="font-display text-lg font-extrabold text-bone">418t CO2e</p>
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-rust">verified credits</p>
        </div>
      </div>
    </div>
  );
}

function EnlargeChip() {
  return (
    <span className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-olive-deep/80 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-bone opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M2 5V2h3M12 9v3H9M9 2h3v3M5 12H2V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Enlarge
    </span>
  );
}

/* the small animated accent badge, a scaled-down StepVisual on a dark chip */
function AccentInset({ index }: { index: number }) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 overflow-hidden rounded-lg border border-white/10 shadow-panel-sm"
      style={{ width: 184, height: 102 }}
    >
      <div className="relative h-full w-full bg-olive-deep">
        <div aria-hidden className="absolute inset-0 data-grid-bg-dark opacity-50" />
        <div
          className="relative"
          style={{ width: 368, height: 204, transform: "scale(0.5)", transformOrigin: "top left" }}
        >
          <div className="h-full p-3">
            <StepVisual index={index} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* the media inside the app window: screenshot + accent, or the emissions graphic.
   Every visual is clickable to enlarge. */
function StepMedia({ index, onOpen }: { index: number; onOpen: (item: ZoomItem) => void }) {
  const m = media[index];
  if (m.type === "emissions") {
    return (
      <button
        type="button"
        onClick={() => onOpen({ kind: "emissions", alt: "The journey of emissions data" })}
        className="group absolute inset-0 block cursor-zoom-in text-left"
        aria-label="Enlarge the journey of emissions data"
      >
        <EmissionsJourney />
        <EnlargeChip />
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => onOpen({ kind: "image", src: m.src, alt: m.alt })}
        className="group absolute inset-0 block cursor-zoom-in"
        aria-label={`Enlarge ${m.alt}`}
      >
        <img src={m.src} alt={m.alt} className="absolute inset-0 h-full w-full object-cover object-left-top" />
        <EnlargeChip />
      </button>
      <AccentInset index={index} />
    </>
  );
}

function WindowChrome({ tag, counter }: { tag: string; counter: string }) {
  return (
    <div className="flex items-center justify-between border-b border-edge/70 bg-bone-light/60 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-rust/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-olive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-edge" />
        </span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          NextPhase · {tag}
        </span>
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-olive">
        <LiveDot />
        {counter}
      </span>
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<ZoomItem | null>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            setActive(idx);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="scroll-mt-16 pt-20 pb-6 md:pt-28 md:pb-8">
      <div className="shell">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-olive-deep sm:text-[2.7rem]">
              From a fact on the floor to revenue, in one connected flow.
            </h2>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-10 lg:mt-10 lg:grid-cols-[1.5fr_0.85fr] lg:gap-8">
          {/* Sticky app window — self-centered so it stays aligned for all four steps */}
          <div className="hidden lg:block">
            <div className="sticky top-[25vh]">
              <div className="flex h-[50vh] flex-col overflow-hidden rounded-2xl border border-edge bg-white shadow-panel">
                <WindowChrome tag={steps[active].tag} counter={`${steps[active].index} / 04`} />
                <div className="relative min-h-0 flex-1 bg-canvas">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0"
                    >
                      <StepMedia index={active} onOpen={setZoom} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-6 lg:space-y-0">
            {steps.map((step, i) => (
              <div
                key={step.index}
                data-index={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`lg:flex lg:items-center lg:py-8 ${
                  i === steps.length - 1 ? "lg:min-h-[52vh]" : "lg:min-h-[34vh]"
                }`}
              >
                {/* mobile inline window */}
                <div className="mb-5 lg:hidden">
                  <div className="overflow-hidden rounded-2xl border border-edge bg-white shadow-panel-sm">
                    <WindowChrome tag={step.tag} counter={`${step.index} / 04`} />
                    <div className="relative aspect-[21/10] bg-canvas">
                      <StepMedia index={i} onOpen={setZoom} />
                    </div>
                  </div>
                </div>

                <div
                  className={`transition-opacity duration-500 ${
                    active === i ? "lg:opacity-100" : "lg:opacity-35"
                  }`}
                >
                  <span className="hidden font-mono text-sm font-semibold text-rust lg:inline">{step.index}</span>
                  <h3 className="mt-2 font-display text-2xl font-bold text-olive-deep sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-base leading-relaxed text-ink/75">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Lightbox item={zoom} onClose={() => setZoom(null)} />
    </section>
  );
}
