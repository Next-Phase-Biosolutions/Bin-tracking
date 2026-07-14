"use client";

import { useClock } from "@/lib/hooks";
import { LiveDot } from "../ui/primitives";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const clock = useClock();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-edge/70 bg-canvas/85 px-4 backdrop-blur-md md:px-6">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-olive-deep lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      <div className="flex items-center gap-2">
        <LiveDot />
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          Live · all systems nominal
        </span>
      </div>

      <div className="ml-auto hidden text-right md:block">
        <p className="font-mono text-sm font-semibold tabular-nums text-olive-deep tnum">
          {clock ? clock.toLocaleTimeString("en-CA", { hour12: false }) : "--:--:--"}
        </p>
        <p className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-muted">facility time</p>
      </div>
    </header>
  );
}
