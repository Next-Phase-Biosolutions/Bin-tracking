
import { useEffect, useRef, useState } from "react";

/** Count up to a target once, on mount. Respects reduced motion. */
export function useCountUp(target: number, opts: { duration?: number; decimals?: number } = {}) {
  const { duration = 1100, decimals = 0 } = opts;
  const [value, setValue] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Live-ticking value that drifts around a base within +/- amplitude, updating on an interval.
 * Used for sensor readouts (temp, humidity, CO2, gas, counters) to feel "live".
 */
export function useTicker(
  base: number,
  opts: { amplitude?: number; interval?: number; decimals?: number; drift?: number } = {},
) {
  const { amplitude = 0.4, interval = 2200, decimals = 1, drift = 0 } = opts;
  const [value, setValue] = useState(base);
  const tickCount = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => {
      tickCount.current += 1;
      const wobble = (Math.random() - 0.5) * 2 * amplitude;
      const next = base + drift * tickCount.current + wobble;
      const f = Math.pow(10, decimals);
      setValue(Math.round(next * f) / f);
    }, interval);
    return () => clearInterval(id);
  }, [base, amplitude, interval, decimals, drift]);

  return value;
}

const SPLASH_DELAY_MS = 200;
const SPLASH_MIN_VISIBLE_MS = 600;

/**
 * Anti-flash gate for a loading splash. Given an async "is loading" flag,
 * returns whether the splash should render right now:
 * - waits {@link SPLASH_DELAY_MS} before showing, so fast loads never flash a splash
 * - once shown, stays up at least {@link SPLASH_MIN_VISIBLE_MS} to avoid a flicker
 */
export function useSplashGate(active: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (shown) return; // already visible — nothing to schedule
      const id = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, SPLASH_DELAY_MS);
      return () => clearTimeout(id);
    }
    if (!shown) return; // never crossed the delay threshold — stay hidden
    const elapsed = shownAt.current ? Date.now() - shownAt.current : SPLASH_MIN_VISIBLE_MS;
    const id = setTimeout(() => {
      shownAt.current = null;
      setShown(false);
    }, Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed));
    return () => clearTimeout(id);
  }, [active, shown]);

  return shown;
}

/** Live clock string HH:MM:SS, updates every second. */
export function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
