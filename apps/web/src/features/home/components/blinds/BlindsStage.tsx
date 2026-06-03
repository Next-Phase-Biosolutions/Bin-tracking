import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLenis } from "../../../../lib/scroll/useLenis";
import { BlindsPanel } from "./BlindsPanel";
import { useBlindsTimeline, timelineUnits } from "./useBlindsTimeline";

const MOBILE_BREAKPOINT = 768;
// Scroll distance (in vh) allotted per timeline unit. Higher = slower transitions.
const VH_PER_UNIT = 60;

interface Dimensions {
  w: number;
  h: number;
}

function readDimensions(): Dimensions {
  if (typeof window === "undefined") return { w: 0, h: 0 };
  return { w: window.innerWidth, h: window.innerHeight };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface BlindsStageProps {
  /** Full-viewport panels in reveal order. The first is the always-visible base. */
  panels: ReactNode[];
}

/**
 * Stacks the given panels as full-viewport layers inside a sticky stage and
 * reveals each one over the previous with a scroll-scrubbed venetian-blind wipe
 * (GSAP ScrollTrigger + Lenis).
 *
 * Falls back to a plain vertical stack of the panels when the user prefers
 * reduced motion or is on a small screen — avoiding scroll-jacking and content
 * overflow inside pinned layers.
 */
export function BlindsStage({ panels }: BlindsStageProps) {
  const [dims, setDims] = useState<Dimensions>(readDimensions);
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const onResize = (): void => setDims(readDimensions());
    window.addEventListener("resize", onResize);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = (): void => setReduced(mq.matches);
    mq.addEventListener("change", onMq);

    return () => {
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const isMobile = dims.w > 0 && dims.w < MOBILE_BREAKPOINT;
  const useStatic = reduced || isMobile;
  const enabled = !useStatic && dims.w > 0 && dims.h > 0;

  const maskedPanels = panels.slice(1);

  useLenis({ enabled });
  useBlindsTimeline({
    enabled,
    height: dims.h,
    panelsRef,
    baseRef,
    stageRef,
  });

  // Reduced-motion / mobile fallback: render panels in normal document flow.
  if (useStatic) {
    return (
      <>
        {panels.map((panel, i) => (
          <div key={i}>{panel}</div>
        ))}
      </>
    );
  }

  const units = timelineUnits(maskedPanels.length);
  const stageHeight = `${Math.round(units * VH_PER_UNIT)}vh`;

  return (
    <div ref={stageRef} className="blinds-stage" style={{ position: "relative", height: stageHeight }}>
      <div
        className="blinds-layers"
        style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}
      >
        {/* Base panel — always visible, sits beneath every masked panel. */}
        <div
          ref={baseRef}
          className="blinds-layer"
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        >
          {panels[0]}
        </div>

        {maskedPanels.map((panel, k) => (
          <BlindsPanel
            key={k + 1}
            zIndex={k + 1}
            ref={(el) => {
              panelsRef.current[k] = el;
            }}
          >
            {panel}
          </BlindsPanel>
        ))}
      </div>
    </div>
  );
}
