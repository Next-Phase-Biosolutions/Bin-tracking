import type { AdminDeviceStatus, ThresholdStatus } from '@bin-tracker/types';
import { toSeriesStats, metricStatus, CORE_METRICS, type SeriesStats } from '../../../lib/zone-sensors';
import { formatAgo } from './format';

export type AdminSeriesKey = 'tempC' | 'humidityPct' | 'rssi' | 'snr' | 'filteredRssi';
export type AdminRange = '24h' | '7d' | '30d';

/** A downsampled admin chart point (sensorAdmin.deviceReadings). */
export interface AdminChartPoint {
  t: number;
  tempC: number | null;
  humidityPct: number | null;
  rssi: number | null;
  snr: number | null;
  filteredRssi: number | null;
}

interface AdminChartConfig {
  key: AdminSeriesKey;
  label: string;
  icon: string;
  unit: string;
  decimals: number;
  floorAtZero: boolean;
  /** Only the thresholded metrics (temperature, humidity) have a status badge and an OK band. */
  statusOf?: (value: number) => ThresholdStatus;
  band?: { low: number | null; high: number };
}

const core = (key: 'tempC' | 'humidityPct') => CORE_METRICS.find((m) => m.key === key)!;

export const ADMIN_CHARTS: readonly AdminChartConfig[] = [
  { ...core('tempC'), floorAtZero: false, statusOf: (v) => metricStatus(v, 'tempC') },
  { ...core('humidityPct'), floorAtZero: true, statusOf: (v) => metricStatus(v, 'humidityPct') },
  { key: 'rssi', label: 'signal (RSSI)', icon: 'bolt', unit: 'dBm', decimals: 0, floorAtZero: false },
  { key: 'snr', label: 'signal-to-noise (SNR)', icon: 'bolt', unit: 'dB', decimals: 1, floorAtZero: false },
  { key: 'filteredRssi', label: 'filtered RSSI', icon: 'bolt', unit: 'dBm', decimals: 0, floorAtZero: false },
];

/** One field of the downsampled series as chart stats; null when the device never reported it in this range. */
export function adminSeries(points: readonly AdminChartPoint[], key: AdminSeriesKey): SeriesStats | null {
  return toSeriesStats(points.map((p) => ({ t: p.t, v: p[key] })));
}

/** The one-line status banner shown at the top of a device's page. */
export function describeStatus(input: {
  status: AdminDeviceStatus;
  latest: { errorCode: number | null; errorMessage: string | null } | null;
  lastSeenAt: Date | null;
  now: Date;
}): string {
  switch (input.status) {
    case 'WAITING':
      return 'Waiting for first reading — the device has not reported yet.';
    case 'OFFLINE':
      return `Offline — last heard ${formatAgo(input.lastSeenAt, input.now)}.`;
    case 'FAULT': {
      const code = input.latest?.errorCode;
      const message = input.latest?.errorMessage;
      return `Fault ${code ?? ''}${message ? `: ${message}` : ''}`.trim();
    }
    case 'ALERT':
    case 'WARN':
      return 'Reporting, but a reading is outside its threshold.';
    case 'UNKNOWN':
      return 'Reporting, but the latest reading has no temperature or humidity.';
    case 'OK':
      return 'Reporting normally.';
  }
}

/** Axis/tooltip time label: time only for a day, date + time for longer ranges. `timeZone` is injectable for tests. */
export function chartTimeFormatter(range: AdminRange, timeZone?: string): (ms: number) => string {
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  const date = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });
  return (ms) => (range === '24h' ? time.format(ms) : `${date.format(ms)}, ${time.format(ms)}`);
}
