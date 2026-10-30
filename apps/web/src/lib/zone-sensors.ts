/**
 * Facility zone ↔ sensor device linkage.
 *
 * A device is assigned to a zone when it is registered (`SensorDevice.zone`,
 * set by `pnpm --filter @bin-tracker/db register:sensor-device --zone ...`), and
 * the zone page picks it from the org-scoped `sensor.listDevices` result — so
 * each tenant sees its own sensor.
 *
 * ponytail: zones are org-wide UI constants with no facility context, so when
 * several facilities in one org each have a device in the same zone, the most
 * recently reporting one wins. Add a facility selector if that ever matters.
 */

import { SENSOR_THRESHOLDS, type ThresholdStatus } from '@bin-tracker/types';
import type { RouterOutputs } from './trpc';

/**
 * The device assigned to this zone ROW (a zone is per facility, so the page
 * resolves slug + facility to a zone first), or `undefined` when none is.
 * Several matches: the most recently reporting wins, and a device that has
 * never reported ranks last.
 */
export function pickZoneDevice<T extends { zone: { id: string } | null; lastSeenAt: Date | null }>(
  devices: readonly T[] | undefined,
  zoneId: string,
): T | undefined {
  let best: T | undefined;
  for (const device of devices ?? []) {
    if (device.zone?.id !== zoneId) continue;
    const seen = device.lastSeenAt?.getTime() ?? -Infinity;
    const bestSeen = best?.lastSeenAt?.getTime() ?? -Infinity;
    if (best === undefined || seen > bestSeen) best = device;
  }
  return best;
}

/**
 * `lastSeenAt` tracks the newest reading's timestamp, so a device that is
 * powered off reads as stale — the honest answer for a card showing current
 * conditions. "Stale" means silent for longer than the platform's offline
 * threshold (`offlineAfterMinutes`, set by platform admins).
 */
export function describeLastSeen(
  lastSeenAt: Date | null,
  offlineAfterMinutes: number,
): { text: string; isStale: boolean } {
  if (!lastSeenAt) return { text: 'no readings yet', isStale: true };

  const elapsedMs = Date.now() - lastSeenAt.getTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return { text: 'updated just now', isStale: false };

  const isStale = elapsedMs > offlineAfterMinutes * 60_000;
  if (minutes < 60) return { text: `updated ${minutes}m ago`, isStale };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { text: `updated ${hours}h ago`, isStale };
  return { text: `updated ${Math.floor(hours / 24)}d ago`, isStale };
}

type FullSensorReading = RouterOutputs['sensor']['getReadings'][number];

export type CoreMetricKey = 'tempC' | 'humidityPct';

interface CoreMetricConfig {
  key: CoreMetricKey;
  label: string;
  unit: string;
  icon: string;
  decimals: number;
  /** The OK band to shade behind the trace. */
  band: { low: number | null; high: number };
}

/**
 * The metrics tenants chart: temperature and humidity only. Other device
 * channels (ammonia, signal strength, faults) are admin-only and are not even
 * sent to tenant clients.
 */
export const CORE_METRICS: readonly CoreMetricConfig[] = [
  {
    key: 'tempC',
    label: 'temperature',
    unit: '°C',
    icon: 'thermo',
    decimals: 2,
    band: { low: SENSOR_THRESHOLDS.temp.warnLow, high: SENSOR_THRESHOLDS.temp.warnHigh },
  },
  {
    key: 'humidityPct',
    label: 'humidity',
    unit: '%',
    icon: 'drop',
    decimals: 2,
    band: { low: SENSOR_THRESHOLDS.humidity.warnLow, high: SENSOR_THRESHOLDS.humidity.warnHigh },
  },
];

/**
 * Per-metric status. `computeThresholdStatus` on the backend only returns one
 * flat overall status for a device (packages/types/src/sensor-thresholds.ts —
 * `{overall, byMetric}` was never built), so the individual temperature/
 * humidity badges on this chart row are computed here instead —
 * against the same exported `SENSOR_THRESHOLDS` constants, not re-derived
 * numbers, so a threshold change upstream doesn't need a matching edit here.
 */
export function metricStatus(value: number, key: CoreMetricKey): ThresholdStatus {
  const t = key === 'tempC' ? SENSOR_THRESHOLDS.temp : SENSOR_THRESHOLDS.humidity;
  if (value < t.alertLow || value > t.alertHigh) return 'ALERT';
  if (value < t.warnLow || value > t.warnHigh) return 'WARN';
  return 'OK';
}

export interface MetricPoint {
  t: number;
  v: number;
}

export interface SeriesStats {
  min: number;
  max: number;
  avg: number;
  latest: number;
  points: MetricPoint[];
}

/**
 * Stats over a series, dropping null values (a metric can be missing on any
 * given row). Returns `null` when nothing is left to chart — callers show an
 * empty state instead of an empty SVG. Shared by the tenant and admin charts.
 */
export function toSeriesStats(raw: ReadonlyArray<{ t: number; v: number | null }>): SeriesStats | null {
  const points: MetricPoint[] = [];
  for (const p of raw) {
    if (p.v !== null) points.push({ t: p.t, v: p.v });
  }
  if (points.length === 0) return null;

  let min = points[0]!.v;
  let max = points[0]!.v;
  let sum = 0;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
    sum += p.v;
  }
  return { min, max, avg: sum / points.length, latest: points[points.length - 1]!.v, points };
}

/** One tenant metric's time series out of a history response. */
export function metricSeries(readings: readonly FullSensorReading[], key: CoreMetricKey): SeriesStats | null {
  return toSeriesStats(readings.map((r) => ({ t: r.timestamp.getTime(), v: r[key] })));
}
