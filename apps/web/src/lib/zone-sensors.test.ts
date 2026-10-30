import { describe, expect, it } from 'vitest';
import { SENSOR_THRESHOLDS } from '@bin-tracker/types';
import { CORE_METRICS, describeLastSeen, metricStatus, metricSeries, pickZoneDevice, toSeriesStats } from './zone-sensors';

const d = (id: string, zoneId: string | null, lastSeenAt: Date | null) => ({
  id,
  zone: zoneId === null ? null : { id: zoneId },
  lastSeenAt,
});

describe('pickZoneDevice', () => {
  it('returns undefined when no device is assigned to the zone', () => {
    expect(pickZoneDevice([d('a', 'zone-kf', new Date())], 'zone-wa')).toBeUndefined();
    expect(pickZoneDevice([], 'zone-wa')).toBeUndefined();
  });

  it('ignores devices with no zone assigned', () => {
    expect(pickZoneDevice([d('a', null, new Date())], 'zone-wa')).toBeUndefined();
  });

  it('returns the device assigned to the zone', () => {
    const devices = [d('a', 'zone-kf', new Date()), d('b', 'zone-wa', new Date())];
    expect(pickZoneDevice(devices, 'zone-wa')?.id).toBe('b');
  });

  it('prefers the most recently reporting device when several share a zone', () => {
    const devices = [
      d('old', 'zone-wa', new Date('2026-10-29T08:00:00Z')),
      d('new', 'zone-wa', new Date('2026-10-29T11:00:00Z')),
      d('mid', 'zone-wa', new Date('2026-10-29T09:00:00Z')),
    ];
    expect(pickZoneDevice(devices, 'zone-wa')?.id).toBe('new');
  });

  it('ranks a device that has never reported below one that has', () => {
    const devices = [d('silent', 'zone-wa', null), d('live', 'zone-wa', new Date('2026-10-29T08:00:00Z'))];
    expect(pickZoneDevice(devices, 'zone-wa')?.id).toBe('live');
  });

  it('still returns a never-reported device when it is the only one', () => {
    expect(pickZoneDevice([d('silent', 'zone-wa', null)], 'zone-wa')?.id).toBe('silent');
  });
});

describe('CORE_METRICS', () => {
  it('charts temperature and humidity only — tenants are not sent ammonia or any other channel', () => {
    expect(CORE_METRICS.map((m) => m.key)).toEqual(['tempC', 'humidityPct']);
  });
});

describe('metricStatus', () => {
  it('follows the shared thresholds for temperature', () => {
    expect(metricStatus(SENSOR_THRESHOLDS.temp.warnHigh, 'tempC')).toBe('OK');
    expect(metricStatus(SENSOR_THRESHOLDS.temp.warnHigh + 1, 'tempC')).toBe('WARN');
    expect(metricStatus(SENSOR_THRESHOLDS.temp.alertHigh + 1, 'tempC')).toBe('ALERT');
  });

  it('follows the shared thresholds for humidity', () => {
    expect(metricStatus(50, 'humidityPct')).toBe('OK');
    expect(metricStatus(SENSOR_THRESHOLDS.humidity.alertLow - 1, 'humidityPct')).toBe('ALERT');
  });
});

describe('describeLastSeen', () => {
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

  it('says "no readings yet" and stale for a device that never reported', () => {
    expect(describeLastSeen(null, 20)).toEqual({ text: 'no readings yet', isStale: true });
  });

  it('is fresh within the platform threshold and stale past it', () => {
    expect(describeLastSeen(ago(5), 20).isStale).toBe(false);
    expect(describeLastSeen(ago(25), 20).isStale).toBe(true);
  });

  it('follows the threshold it is given, not a fixed 20 minutes', () => {
    expect(describeLastSeen(ago(10), 5).isStale).toBe(true);
    expect(describeLastSeen(ago(10), 60).isStale).toBe(false);
  });

  it('formats minutes, hours and days', () => {
    expect(describeLastSeen(ago(0), 20).text).toBe('updated just now');
    expect(describeLastSeen(ago(7), 20).text).toBe('updated 7m ago');
    expect(describeLastSeen(ago(3 * 60), 20).text).toBe('updated 3h ago');
    expect(describeLastSeen(ago(2 * 24 * 60), 20).text).toBe('updated 2d ago');
  });
});

describe('toSeriesStats', () => {
  it('computes min, max, avg and latest over the non-null points', () => {
    const stats = toSeriesStats([
      { t: 1, v: 4 },
      { t: 2, v: null },
      { t: 3, v: 8 },
    ]);
    expect(stats).toEqual({
      min: 4,
      max: 8,
      avg: 6,
      latest: 8,
      points: [
        { t: 1, v: 4 },
        { t: 3, v: 8 },
      ],
    });
  });

  it('returns null when there is nothing to chart', () => {
    expect(toSeriesStats([])).toBeNull();
    expect(toSeriesStats([{ t: 1, v: null }])).toBeNull();
  });
});

describe('metricSeries', () => {
  it('charts one tenant metric, dropping nulls', () => {
    const readings = [
      { timestamp: new Date(1000), tempC: 4, humidityPct: null },
      { timestamp: new Date(2000), tempC: null, humidityPct: 50 },
      { timestamp: new Date(3000), tempC: 6, humidityPct: 52 },
    ];
    expect(metricSeries(readings, 'tempC')!.points).toEqual([
      { t: 1000, v: 4 },
      { t: 3000, v: 6 },
    ]);
    expect(metricSeries(readings, 'humidityPct')!.latest).toBe(52);
  });
});
