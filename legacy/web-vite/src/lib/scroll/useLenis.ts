import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface UseLenisOptions {
  /** When false, Lenis is not initialised (e.g. reduced-motion / mobile fallback). */
  enabled: boolean;
  /** Linear interpolation factor — lower is smoother/slower. Matches the reference demo. */
  lerp?: number;
}

/**
 * Starts Lenis smooth scrolling and wires it into GSAP's ticker and ScrollTrigger,
 * mirroring the reference implementation:
 *   - lenis.on('scroll', ScrollTrigger.update)
 *   - gsap.ticker drives lenis.raf()
 *
 * Cleans everything up on unmount or when disabled.
 */
export function useLenis({ enabled, lerp = 0.15 }: UseLenisOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({ lerp, smoothWheel: true });

    const onScroll = (): void => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    const raf = (time: number): void => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [enabled, lerp]);
}
