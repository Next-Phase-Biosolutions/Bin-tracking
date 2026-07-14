"use client";

import { useCountUp, useTicker } from "@/lib/hooks";

/** A number that counts up on mount. */
export function CountValue({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const v = useCountUp(value, { decimals });
  return <span className="tnum">{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

/** A sensor reading that gently drifts to feel live. */
export function TickValue({
  base,
  unit,
  decimals = 1,
  amplitude = 0.4,
}: {
  base: number;
  unit?: string;
  decimals?: number;
  amplitude?: number;
}) {
  const v = useTicker(base, { decimals, amplitude });
  return (
    <span className="tnum">
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {unit ? <span className="ml-0.5 text-[0.7em] opacity-60">{unit}</span> : null}
    </span>
  );
}
