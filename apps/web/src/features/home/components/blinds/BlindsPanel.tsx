import { forwardRef, type ReactNode } from "react";

interface BlindsPanelProps {
  /** Stacking order — higher panels reveal over lower ones. */
  zIndex: number;
  children: ReactNode;
}

/**
 * A single full-viewport, opaque HTML layer that gets a venetian-blind CSS mask
 * applied imperatively by the parent stage (see buildBlinds + useBlindsTimeline).
 * The forwarded ref points at the masked element.
 */
export const BlindsPanel = forwardRef<HTMLDivElement, BlindsPanelProps>(
  function BlindsPanel({ zIndex, children }, ref) {
    return (
      <div
        ref={ref}
        className="blinds-panel"
        style={{ position: "absolute", inset: 0, zIndex, willChange: "mask-position, mask-size" }}
      >
        {children}
      </div>
    );
  }
);
