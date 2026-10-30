import { describe, expect, it } from 'vitest';
import { adminSeries, ADMIN_CHARTS, chartTimeFormatter, describeStatus } from './device-detail';

const point = (t: number, over: Partial<Record<'tempC' | 'humidityPct' | 'rssi' | 'snr' | 'filteredRssi', number | null>> = {}) => ({
  t,
  tempC: null,
  humidityPct: null,
  rssi: null,
  snr: null,
  filteredRssi: null,
  count: 1,
  faults: 0,
  ...over,
});

describe('ADMIN_CHARTS', () => {
  it('charts temperature, humidity, RSSI, SNR and filtered RSSI, in that order', () => {
    expect(ADMIN_CHARTS.map((c) => c.key)).toEqual(['tempC', 'humidityPct', 'rssi', 'snr', 'filteredRssi']);
  });

  it('does not clip negative signal metrics at zero', () => {
    for (const key of ['rssi', 'snr', 'filteredRssi'] as const) {
      expect(ADMIN_CHARTS.find((c) => c.key === key)!.floorAtZero).toBe(false);
    }
  });

  it('only temperature and humidity have threshold status and bands', () => {
    for (const chart of ADMIN_CHARTS) {
      const thresholded = chart.key === 'tempC' || chart.key === 'humidityPct';
      expect(Boolean(chart.statusOf)).toBe(thresholded);
      expect(Boolean(chart.band)).toBe(thresholded);
    }
  });
});

describe('adminSeries', () => {
  const points = [point(1000, { rssi: -70, tempC: 4 }), point(2000, { rssi: null, tempC: 6 }), point(3000, { rssi: -74 })];

  it('builds stats for one field, dropping buckets where it is missing', () => {
    expect(adminSeries(points, 'rssi')).toEqual({
      min: -74,
      max: -70,
      avg: -72,
      latest: -74,
      points: [
        { t: 1000, v: -70 },
        { t: 3000, v: -74 },
      ],
    });
  });

  it('returns null when a field was never reported', () => {
    expect(adminSeries(points, 'snr')).toBeNull();
    expect(adminSeries([], 'tempC')).toBeNull();
  });
});

describe('describeStatus', () => {
  const NOW = new Date('2026-10-30T12:00:00.000Z');
  const seen = new Date(NOW.getTime() - 5 * 60_000);
  const reading = (over: Record<string, unknown> = {}) => ({ errorCode: null, errorMessage: null, ...over });

  it('says the device is waiting for its first reading', () => {
    expect(describeStatus({ status: 'WAITING', latest: null, lastSeenAt: null, now: NOW })).toMatch(/waiting for first reading/i);
  });

  it('says when it was last heard when offline', () => {
    expect(describeStatus({ status: 'OFFLINE', latest: reading(), lastSeenAt: seen, now: NOW })).toMatch(/offline.*5m ago/i);
  });

  it('shows the fault code and message', () => {
    const text = describeStatus({ status: 'FAULT', latest: reading({ errorCode: 100, errorMessage: 'sensor read timeout' }), lastSeenAt: seen, now: NOW });
    expect(text).toContain('100');
    expect(text).toContain('sensor read timeout');
  });

  it('copes with a fault that has no message', () => {
    expect(describeStatus({ status: 'FAULT', latest: reading({ errorCode: 201 }), lastSeenAt: seen, now: NOW })).toContain('201');
  });

  it('describes healthy, out-of-range and unmeasured readings', () => {
    expect(describeStatus({ status: 'OK', latest: reading(), lastSeenAt: seen, now: NOW })).toMatch(/normally/i);
    expect(describeStatus({ status: 'ALERT', latest: reading(), lastSeenAt: seen, now: NOW })).toMatch(/outside/i);
    expect(describeStatus({ status: 'WARN', latest: reading(), lastSeenAt: seen, now: NOW })).toMatch(/outside/i);
    expect(describeStatus({ status: 'UNKNOWN', latest: reading(), lastSeenAt: seen, now: NOW })).toMatch(/no temperature or humidity/i);
  });
});

describe('chartTimeFormatter', () => {
  const t = Date.parse('2026-10-30T10:05:00Z');

  it('shows just the time for a 24h chart', () => {
    expect(chartTimeFormatter('24h', 'UTC')(t)).toBe('10:05');
  });

  it('adds the date for 7d and 30d charts, which span several days', () => {
    expect(chartTimeFormatter('7d', 'UTC')(t)).toBe('Oct 30, 10:05');
    expect(chartTimeFormatter('30d', 'UTC')(t)).toBe('Oct 30, 10:05');
  });
});
