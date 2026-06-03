import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BLIND_COUNT, createBands, initBlindsMask, updateBlindsMask, type Band } from "./buildBlinds";

gsap.registerPlugin(ScrollTrigger);

// Timeline rhythm (abstract units; scroll distance is scaled to match).
const LEAD = 1.0; // hold on the base panel before the first transition
const OPEN = 1.0; // base duration of one blinds-open transition
const GAP = 1.0; // hold between transitions (each section dwells fully revealed)
const TRAIL = 1.0; // hold on the final panel before the stage releases
const STAGGER_EACH = 0.02; // per-band stagger
const SCRUB = 1.0; // scroll-follow smoothing (crisp; was 2.5 and caused smear)
// A panel becomes interactive once it is mostly open.
const INTERACTIVE_AT = 0.6;

// The real visual length of one transition includes the staggered cascade, so
// consecutive transitions MUST be spaced by at least this much or they overlap.
const STAGGER_SPREAD = STAGGER_EACH * (BLIND_COUNT - 1);
const TRANSITION_SPAN = OPEN + STAGGER_SPREAD;
const STEP = TRANSITION_SPAN + GAP;

/** Timeline start time of transition `k` (0-based). */
function transitionAt(k: number): number {
  return LEAD + k * STEP;
}

/** Total timeline length for `maskedCount` transitions. */
export function timelineUnits(maskedCount: number): number {
  if (maskedCount <= 0) return 0;
  return transitionAt(maskedCount - 1) + TRANSITION_SPAN + TRAIL;
}

interface UseBlindsTimelineParams {
  enabled: boolean;
  height: number;
  /** Each masked panel element, in reveal order. Indexes may be null pre-mount. */
  panelsRef: RefObject<(HTMLDivElement | null)[]>;
  /** The always-visible base panel (index 0), toggled interactive when on top. */
  baseRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
}

/**
 * Builds the scrubbed ScrollTrigger timeline that opens each masked panel's
 * venetian-blind CSS mask in sequence as the user scrolls through the sticky
 * stage. Transitions are spaced by the full staggered span so only one wipe is
 * ever in flight — no piling of multiple sections over the base. A GSAP proxy
 * array per panel drives the cascade; the timeline `onUpdate` writes the mask
 * each frame, and `pointer-events` track the panel currently on top.
 */
export function useBlindsTimeline({
  enabled,
  height,
  panelsRef,
  baseRef,
  stageRef,
}: UseBlindsTimelineParams): void {
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!enabled || !stageEl || height === 0) return;

    const panels = panelsRef.current ?? [];
    const bandsPerPanel: Band[][] = panels.map(() => createBands());

    panels.forEach((el, k) => {
      if (!el) return;
      initBlindsMask(el);
      updateBlindsMask(el, bandsPerPanel[k], height);
    });

    const applyMasks = (): void => {
      panels.forEach((el, k) => {
        if (el) updateBlindsMask(el, bandsPerPanel[k], height);
      });
    };

    const setActive = (active: number): void => {
      const baseEl = baseRef.current;
      if (baseEl) baseEl.style.pointerEvents = active === -1 ? "auto" : "none";
      panels.forEach((el, k) => {
        if (el) el.style.pointerEvents = k === active ? "auto" : "none";
      });
    };

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onUpdate: applyMasks,
        scrollTrigger: {
          trigger: stageEl,
          start: "top top",
          end: "bottom bottom",
          scrub: SCRUB,
          invalidateOnRefresh: true,
          onUpdate: (self: ScrollTrigger) => {
            const t = self.progress * tl.duration();
            let active = -1; // -1 = base panel on top
            bandsPerPanel.forEach((_, k) => {
              const openEnd = transitionAt(k) + TRANSITION_SPAN * INTERACTIVE_AT;
              if (t >= openEnd) active = k;
            });
            setActive(active);
          },
        },
      });

      bandsPerPanel.forEach((bands, k) => {
        tl.to(
          bands,
          { v: 1, ease: "power3.out", duration: OPEN, stagger: { each: STAGGER_EACH, from: "start" } },
          transitionAt(k)
        );
      });
    }, stageEl);

    setActive(-1);
    applyMasks();
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, [enabled, height, panelsRef, baseRef, stageRef]);
}
