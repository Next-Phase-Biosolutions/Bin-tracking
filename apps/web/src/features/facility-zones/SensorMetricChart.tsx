import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Badge, Reveal } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { CoreMetricKey, SeriesStats } from '../../lib/zone-sensors';
import { metricStatus } from '../../lib/zone-sensors';

const STATUS_TONE = { OK: 'good', WARN: 'warn', ALERT: 'alert', UNKNOWN: 'idle' } as const;

/** More points than this and 24h of a 5-min-cadence device is redrawing detail no one can see at card width. */
const MAX_PLOTTED_POINTS = 300;

interface ChartDatum {
  t: number;
  v: number;
}

function downsample(points: readonly ChartDatum[], limit: number): ChartDatum[] {
  if (points.length <= limit) return [...points];
  const step = points.length / limit;
  const out: ChartDatum[] = [];
  for (let i = 0; i < limit; i++) out.push(points[Math.floor(i * step)]!);
  out.push(points[points.length - 1]!);
  return out;
}

interface SensorMetricChartProps {
  metricKey: CoreMetricKey;
  label: string;
  icon: string;
  unit: string;
  decimals: number;
  /** The OK band to shade behind the trace. `low: null` means no floor (ammonia). */
  band: { low: number | null; high: number };
  series: SeriesStats;
  /** Formats a point's timestamp for the x-axis, in the org's own timezone (not the browser's). */
  formatTime: (ms: number) => string;
}

function TooltipCard({
  active,
  payload,
  formatTime,
  fmt,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  formatTime: (ms: number) => string;
  fmt: (v: number) => string;
  unit: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-edge/70 bg-white px-3 py-2 shadow-card">
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">
        {formatTime(point.t)}
      </p>
      <p className="mt-0.5 font-display text-sm font-bold text-olive-deep tnum">
        {fmt(point.v)}
        <span className="ml-0.5 text-xs font-semibold text-muted">{unit}</span>
      </p>
    </div>
  );
}

export function SensorMetricChart({
  metricKey,
  label,
  icon,
  unit,
  decimals,
  band,
  series,
  formatTime,
}: SensorMetricChartProps) {
  const status = metricStatus(series.latest, metricKey);
  const fmt = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const { data, domain, bandRange, ticks, yTicks } = useMemo(() => {
    const plotted = downsample(series.points, MAX_PLOTTED_POINTS);

    // Domain follows the DATA, not the threshold band. SENSOR_THRESHOLDS is
    // placeholder-calibrated (packages/types/src/sensor-thresholds.ts) and can
    // sit orders of magnitude from what a real device reports — forcing the
    // domain to stretch to the band would flatten the actual trend into a
    // flat line hugging one edge. Never past zero for %/ppm units.
    const rawSpan = series.max - series.min || Math.abs(series.max) * 0.1 || 1;
    let domainMin = series.min - rawSpan * 0.18;
    const domainMax = series.max + rawSpan * 0.18;
    if (unit !== '°C') domainMin = Math.max(0, domainMin);

    // Band clipped to the visible domain — a threshold miles outside today's
    // readings has nothing meaningful to shade and would otherwise either
    // vanish entirely or paint the whole plot solid.
    const bandLow = Math.max(band.low ?? domainMin, domainMin);
    const bandHigh = Math.min(band.high, domainMax);
    const hasBand = bandHigh > domainMin && bandLow < domainMax && bandHigh > bandLow;

    const tickCount = 4;
    const tickTimes = Array.from({ length: tickCount }, (_, i) => {
      const idx = Math.round((i / (tickCount - 1)) * (plotted.length - 1));
      return plotted[idx]!.t;
    });
    // Computed explicitly rather than left to recharts' auto-tick generation —
    // combining an explicit `domain` with `tickCount` produced tick VALUES that
    // didn't land on the domain at all (observed: a 26-34 domain rendering
    // ticks like 3.5 and 9.5). Owning the numbers outright removes the ambiguity.
    const yTicks = Array.from(
      { length: tickCount },
      (_, i) => domainMin + (i / (tickCount - 1)) * (domainMax - domainMin),
    );

    return {
      data: plotted,
      domain: [domainMin, domainMax] as [number, number],
      bandRange: hasBand ? ([bandLow, bandHigh] as [number, number]) : null,
      ticks: tickTimes,
      yTicks,
    };
  }, [series, band, unit]);

  const gradientId = `sensor-gradient-${metricKey}`;

  return (
    <Reveal>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name={icon} width={15} height={15} className="text-olive" />
            <span className="kicker">{label}</span>
          </div>
          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <p className="font-display text-3xl font-extrabold leading-none tracking-tight text-olive-deep tnum">
            {fmt(series.latest)}
            <span className="ml-1 text-sm font-bold text-muted">{unit}</span>
          </p>
          <div className="text-right font-mono text-[0.58rem] uppercase leading-tight text-muted tnum">
            <p>min {fmt(series.min)}</p>
            <p>avg {fmt(series.avg)}</p>
            <p>max {fmt(series.max)}</p>
          </div>
        </div>

        <div className="mt-3 h-[168px] w-full" role="img" aria-label={`${label} trend, last 24 hours`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-rust)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-rust)" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="var(--color-edge)"
                strokeOpacity={0.35}
                strokeDasharray="2 4"
                vertical={false}
              />

              {bandRange ? (
                <ReferenceArea
                  y1={bandRange[0]}
                  y2={bandRange[1]}
                  fill="var(--color-live)"
                  fillOpacity={0.08}
                  stroke="none"
                  ifOverflow="hidden"
                />
              ) : null}

              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={(v: number) => formatTime(v)}
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-muted)' }}
                axisLine={{ stroke: 'var(--color-edge)', strokeOpacity: 0.5 }}
                tickLine={false}
                height={20}
              />
              <YAxis
                type="number"
                domain={domain}
                ticks={yTicks}
                tickFormatter={(v: number) => fmt(v)}
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-muted)' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />

              <Tooltip
                content={<TooltipCard formatTime={formatTime} fmt={fmt} unit={unit} />}
                cursor={{ stroke: 'var(--color-olive)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />

              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--color-rust)"
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3.5, fill: 'var(--color-rust)', stroke: 'var(--color-canvas)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Reveal>
  );
}
