
import { useCountUp } from "@/lib/hooks";

export function RadialGauge({
  value,
  label,
  suffix = "%",
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const { value: animated, ref } = useCountUp(value, 1600);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, animated);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-[92px] w-[92px]">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#C2B9A3" strokeWidth="6" opacity="0.4" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="#A8442A"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.3s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span ref={ref} className="font-display text-xl font-extrabold tabular-nums text-olive-deep">
            {animated.toFixed(1)}
            {suffix}
          </span>
        </div>
      </div>
      <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
    </div>
  );
}
