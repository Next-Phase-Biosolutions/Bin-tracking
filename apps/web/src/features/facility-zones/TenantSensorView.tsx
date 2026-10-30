import { Card, LiveDot } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { useClock } from '../../lib/hooks';
import { CORE_METRICS, describeLastSeen, metricSeries, metricStatus } from '../../lib/zone-sensors';
import type { RouterOutputs } from '../../lib/trpc';
import { SensorMetricChart } from './SensorMetricChart';

type TenantReadings = RouterOutputs['sensor']['getReadings'];

interface TenantSensorViewProps {
  /** The tenant-facing device name (never the hardware id). */
  deviceName: string;
  /** Shown in the loading state. */
  zoneName: string;
  history: TenantReadings | undefined;
  isLoading: boolean;
  /** Formats a point's timestamp for the x-axis, in the org's own timezone. */
  formatTime: (ms: number) => string;
}

/**
 * What a tenant sees of a sensor: temperature and humidity charts. The same
 * component renders the admin's "view as tenant" page, so the two cannot drift.
 */
export function TenantSensorView({ deviceName, zoneName, history, isLoading, formatTime }: TenantSensorViewProps) {
  if (isLoading) {
    return (
      <div className="mt-2 flex min-h-[30vh] items-center justify-center">
        <FacilityLoader variant="inline" label={zoneName} />
      </div>
    );
  }

  // Independently per metric, in case one channel has gaps another doesn't —
  // a device that's never reported humidity shouldn't blank out its temperature chart.
  const charts = CORE_METRICS.map((metric) => ({ metric, series: metricSeries(history ?? [], metric.key) })).filter(
    (c): c is { metric: (typeof CORE_METRICS)[number]; series: NonNullable<ReturnType<typeof metricSeries>> } =>
      c.series !== null && c.series.points.length >= 2,
  );

  if (charts.length === 0) {
    return (
      <div className="mt-2 flex min-h-[30vh] items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">awaiting first reading</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="kicker">{deviceName}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {charts.map(({ metric, series }) => (
          <SensorMetricChart
            key={metric.key}
            label={metric.label}
            icon={metric.icon}
            unit={metric.unit}
            decimals={metric.decimals}
            band={metric.band}
            statusOf={(value) => metricStatus(value, metric.key)}
            series={series}
            formatTime={formatTime}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Ticking "time since the last sensor reading" chip for a zone header. Counts
 * up every second (via `useClock`) and resets whenever `lastSeenAt` changes —
 * i.e. when the 60s refetch pulls in a fresher reading. Green while fresh, amber
 * once the feed goes stale (silent past `offlineAfterMinutes`).
 */
export function LiveSinceReading({ lastSeenAt, offlineAfterMinutes }: { lastSeenAt: Date; offlineAfterMinutes: number }) {
  const now = useClock();
  const { isStale } = describeLastSeen(lastSeenAt, offlineAfterMinutes);
  const elapsedMs = Math.max(0, (now?.getTime() ?? Date.now()) - new Date(lastSeenAt).getTime());
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const elapsed = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
        isStale ? 'bg-warn/10 text-warn' : 'bg-live/10 text-live'
      }`}
    >
      {isStale ? <Icon name="refresh" width={11} height={11} /> : <LiveDot />}
      <span className="tnum">{elapsed}</span>
      <span className="opacity-70">since last reading</span>
    </span>
  );
}
