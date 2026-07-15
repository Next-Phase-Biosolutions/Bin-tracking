
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Counts up to `target` once the element scrolls into view. Returns the current
 * value and a ref to attach to the element. Respects reduced motion by jumping
 * straight to the target.
 */
export function useCountUp(target: number, durationMs = 1400) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduce) {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;

        const start = performance.now();
        const tick = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / durationMs, 1);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
          else setValue(target);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target, durationMs, reduce]);

  return { value, ref };
}

/**
 * Drives a value that drifts around a baseline on an interval, for live looking
 * telemetry. Pauses entirely under reduced motion.
 */
export function useTicker({
  base,
  amplitude,
  intervalMs = 1800,
  decimals = 1,
}: {
  base: number;
  amplitude: number;
  intervalMs?: number;
  decimals?: number;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(base);

  useEffect(() => {
    if (reduce) {
      setValue(base);
      return;
    }
    const round = (n: number) => {
      const p = Math.pow(10, decimals);
      return Math.round(n * p) / p;
    };
    const id = setInterval(() => {
      const drift = (Math.random() - 0.5) * 2 * amplitude;
      setValue(round(base + drift));
    }, intervalMs);
    return () => clearInterval(id);
  }, [base, amplitude, intervalMs, decimals, reduce]);

  return value;
}

/**
 * Increments a running counter on an interval, like a tally that keeps climbing.
 */
export function useIncrement({
  start,
  step,
  intervalMs = 2600,
}: {
  start: number;
  step: number;
  intervalMs?: number;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setValue((v) => v + step);
    }, intervalMs);
    return () => clearInterval(id);
  }, [step, intervalMs, reduce]);

  return value;
}
