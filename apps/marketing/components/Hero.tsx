"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CTAButton } from "./ui/atoms";
import { HeroDashboard } from "./dashboard/HeroDashboard";

const headlineLines = ["Nothing wasted.", "One source of truth."];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-olive-deep pt-28 text-bone md:pt-36"
    >
      {/* looping industrial footage */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        autoPlay={!reduce}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* warm scrim: darken evenly, stronger on the left behind the headline */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-olive-deep/55" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-olive-deep/90 via-olive-deep/55 to-olive-deep/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-olive-deep via-olive-deep/10 to-olive-deep/35"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-rust/15 blur-3xl"
      />

      <div className="shell relative grid items-center gap-12 pb-20 md:pb-28 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-bone/25 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rust" />
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/85">
              The operating system for zero waste meat processing
            </span>
          </motion.div>

          <h1 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-bone sm:text-6xl lg:text-[4.1rem]">
            {headlineLines.map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span
                  className="block"
                  initial={reduce ? false : { y: "100%" }}
                  animate={reduce ? false : { y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.21, 0.6, 0.27, 1] }}
                >
                  {i === 1 ? (
                    <>
                      One source of <span className="text-rust">truth.</span>
                    </>
                  ) : (
                    line
                  )}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-bone-light"
          >
            We bring the entire plant online with sensors, cameras, scales, and
            voice, turn that capture into decisions with AI, seal every record on
            a blockchain, and turn the waste you used to pay to discard into
            byproduct sales and verified carbon credits.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <CTAButton href="#how-it-works" variant="primary">
              See how it works
            </CTAButton>
            <CTAButton href="#contact" variant="ghost">
              Contact Sales
            </CTAButton>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? false : { opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-bone-light"
          >
            <span>CFIA</span>
            <span className="text-bone-light/40">·</span>
            <span>Vision AI</span>
            <span className="text-bone-light/40">·</span>
            <span>Carbon Credits</span>
            <span className="text-bone-light/40">·</span>
            <span>Blockchain Verified</span>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={reduce ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="lg:pl-4"
        >
          <HeroDashboard />
        </motion.div>
      </div>
    </section>
  );
}
