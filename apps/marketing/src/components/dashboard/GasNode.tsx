
import { useTicker } from "@/lib/hooks";
import { Bar } from "./primitives";

interface Gas {
  symbol: string;
  name: string;
  base: number;
  amplitude: number;
  unit: string;
  max: number;
  decimals: number;
}

const gases: Gas[] = [
  { symbol: "CH4", name: "Methane", base: 11.4, amplitude: 2.4, unit: "ppm", max: 50, decimals: 1 },
  { symbol: "CO2", name: "Carbon dioxide", base: 642, amplitude: 38, unit: "ppm", max: 1500, decimals: 0 },
  { symbol: "H2S", name: "Hydrogen sulphide", base: 3.1, amplitude: 0.9, unit: "ppm", max: 10, decimals: 1 },
  { symbol: "NH3", name: "Ammonia", base: 6.4, amplitude: 1.8, unit: "ppm", max: 25, decimals: 1 },
  { symbol: "CO", name: "Carbon monoxide", base: 2.0, amplitude: 0.8, unit: "ppm", max: 35, decimals: 1 },
];

function GasRow({ gas, dark }: { gas: Gas; dark: boolean }) {
  const value = useTicker({
    base: gas.base,
    amplitude: gas.amplitude,
    decimals: gas.decimals,
    intervalMs: 2000 + Math.random() * 800,
  });
  const display = gas.decimals === 0 ? Math.round(value) : value.toFixed(gas.decimals);

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 shrink-0">
        <p className={`font-mono text-xs font-semibold ${dark ? "text-bone" : "text-olive-deep"}`}>
          {gas.symbol}
        </p>
        <p className={`text-[0.6rem] ${dark ? "text-bone/45" : "text-muted"}`}>{gas.name}</p>
      </div>
      <Bar value={value} max={gas.max} tone="olive" className={dark ? "bg-white/10" : ""} />
      <div className="w-20 shrink-0 text-right">
        <span className={`font-mono text-sm tabular-nums ${dark ? "text-bone" : "text-ink"}`}>
          {display}
        </span>
        <span className={`ml-1 font-mono text-[0.62rem] ${dark ? "text-bone/45" : "text-muted"}`}>
          {gas.unit}
        </span>
      </div>
    </div>
  );
}

export function GasNode({ dark = false }: { dark?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`font-mono text-[0.66rem] uppercase tracking-[0.16em] ${dark ? "text-bone/60" : "text-muted"}`}>
          M1 node · five gas
        </p>
        <span className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-olive">
          <span className="h-1.5 w-1.5 rounded-full bg-olive" />
          All nominal
        </span>
      </div>
      {gases.map((gas) => (
        <GasRow key={gas.symbol} gas={gas} dark={dark} />
      ))}
      <p className={`pt-1 text-[0.64rem] ${dark ? "text-bone/40" : "text-muted"}`}>
        Industrial grade sensors, calibration traced. Audit accepted.
      </p>
    </div>
  );
}
