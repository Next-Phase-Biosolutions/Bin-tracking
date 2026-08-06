/**
 * Facility zone → EcoSafeSense device mapping.
 *
 * `SensorDevice` carries `organizationId` and `facilityId` but has no zone
 * column, and facility zones are frontend-only constants (facility-zones-data.ts)
 * with no backend representation at all — so nothing in the API can answer
 * "which device is in Wet Aging". This map is that link until one exists.
 *
 * ponytail: single-device demo mapping via env var. Replace with a
 * `SensorDevice.zone` column once a second zone gets a sensor — this shape
 * cannot express two devices in one zone, or one device shared across zones.
 */

import { SENSOR_THRESHOLDS, type ThresholdStatus } from '@bin-tracker/types';
import type { RouterOutputs } from './trpc';

/** Zone id (see `zones` in facility-zones-data.ts) → vendor device `externalId`. */
const ZONE_SENSOR_EXTERNAL_IDS: Record<string, string | undefined> = {
  wetaging: import.meta.env.VITE_ZONE_SENSOR_WETAGING,
};

/**
 * The vendor device id wired to this zone, or `undefined` when the zone has no
 * sensor configured — callers fall back to the zone's mock readings rather than
 * firing a query that can only come back empty.
 */
export function sensorIdForZone(zoneId: string): string | undefined {
  return ZONE_SENSOR_EXTERNAL_IDS[zoneId] || undefined;
}

type SensorDevice = RouterOutputs['sensor']['listDevices']['devices'][number];
type SensorReading = SensorDevice['readings'][number];

/** Same shape as `ZoneEnv` so the zone page renders live and mock rows through one loop. */
export interface ZoneEnvRow {
  label: string;
  value: number;
  unit: string;
  decimals: number;
}

/**
 * The four metrics worth surfacing on a zone card, in the order the mock data
 * established (temperature, humidity, co2) plus ammonia — the one air-quality
 * reading that actually matters for aging meat. The other five the device
 * reports have no thresholds and no place on a summary card; they belong on a
 * dedicated environment page if one ever gets built.
 *
 * Temperature is shown in °C, not the mock's °F: the sensor reports Celsius and
 * every other zone's mock readings are already Celsius, so converting here would
 * make Wet Aging the only zone in a different unit.
 */
export function toEnvRows(reading: SensorReading): ZoneEnvRow[] {
  const rows: Array<ZoneEnvRow | null> = [
    { label: 'temperature', value: reading.tempC, unit: '°C', decimals: 1 },
    { label: 'humidity', value: reading.humidityPct, unit: '%', decimals: 0 },
    reading.nh3Ppm === null
      ? null
      : { label: 'ammonia', value: reading.nh3Ppm, unit: 'ppm', decimals: 4 },
    reading.eco2Ppm === null
      ? null
      : { label: 'co2_levels', value: reading.eco2Ppm, unit: 'ppm', decimals: 0 },
  ];
  return rows.filter((row): row is ZoneEnvRow => row !== null);
}

/** Past this, the card stops claiming the reading is current. Poll cadence is ~10 min. */
const STALE_AFTER_MS = 20 * 60 * 1000;

/**
 * `lastSeenAt` tracks the newest reading's timestamp, not the last successful
 * poll — a device that is powered off but still being polled reads as stale,
 * which is the honest answer for a card showing environmental conditions.
 */
export function describeLastSeen(lastSeenAt: Date | null): { text: string; isStale: boolean } {
  if (!lastSeenAt) return { text: 'no readings yet', isStale: true };

  const elapsedMs = Date.now() - lastSeenAt.getTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return { text: 'updated just now', isStale: false };

  const isStale = elapsedMs > STALE_AFTER_MS;
  if (minutes < 60) return { text: `updated ${minutes}m ago`, isStale };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { text: `updated ${hours}h ago`, isStale };
  return { text: `updated ${Math.floor(hours / 24)}d ago`, isStale };
}

type FullSensorReading = RouterOutputs['sensor']['getReadings'][number];

export type CoreMetricKey = 'tempC' | 'humidityPct' | 'nh3Ppm';

interface CoreMetricConfig {
  key: CoreMetricKey;
  label: string;
  unit: string;
  icon: string;
  decimals: number;
  /** The OK band to shade behind the trace. `low: null` for a metric with no floor (ammonia). */
  band: { low: number | null; high: number };
}

/**
 * The three metrics `computeThresholdStatus` (packages/types/src/sensor-thresholds.ts)
 * actually gates on — same set the backend's `latestStatus` is computed from,
 * which is why this is titled "core" rather than listing all 9 device fields.
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
  {
    key: 'nh3Ppm',
    label: 'ammonia',
    unit: 'ppm',
    icon: 'gas',
    decimals: 2,
    band: { low: null, high: SENSOR_THRESHOLDS.nh3.warnPpm },
  },
];

/**
 * Per-metric status. `computeThresholdStatus` on the backend only returns one
 * flat overall status for a device (packages/types/src/sensor-thresholds.ts —
 * `{overall, byMetric}` was never built), so the individual temperature/
 * humidity/ammonia badges on this chart row are computed here instead —
 * against the same exported `SENSOR_THRESHOLDS` constants, not re-derived
 * numbers, so a threshold change upstream doesn't need a matching edit here.
 */
export function metricStatus(value: number, key: CoreMetricKey): ThresholdStatus {
  if (key === 'nh3Ppm') {
    if (value > SENSOR_THRESHOLDS.nh3.alertPpm) return 'ALERT';
    if (value > SENSOR_THRESHOLDS.nh3.warnPpm) return 'WARN';
    return 'OK';
  }
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
 * Pulls one metric's time series out of a history response, dropping nulls
 * (every core metric can be null on a given row, even though in practice the
 * live device has never sent one). Returns `null` when there's nothing to
 * chart — callers show an empty state instead of an empty SVG.
 */
export function metricSeries(
  readings: readonly FullSensorReading[],
  key: CoreMetricKey,
): SeriesStats | null {
  const points: MetricPoint[] = [];
  for (const r of readings) {
    const v = r[key];
    if (v !== null) points.push({ t: r.timestamp.getTime(), v });
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
