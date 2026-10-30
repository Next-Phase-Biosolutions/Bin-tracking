import { describe, expect, it } from 'vitest';
import { BUCKET_MS, downsampleReadings } from './downsample.js';

const row = (iso: string, over: Partial<Parameters<typeof downsampleReadings>[0][number]> = {}) => ({
  timestamp: new Date(iso),
  tempC: null,
  humidityPct: null,
  rssi: null,
  snr: null,
  filteredRssi: null,
  errorCode: null,
  ...over,
});

const FIVE_MIN = 5 * 60_000;

describe('BUCKET_MS', () => {
  it('uses 5 min, 30 min and 2 h buckets for 24h, 7d and 30d', () => {
    expect(BUCKET_MS).toEqual({ '24h': 300_000, '7d': 1_800_000, '30d': 7_200_000 });
  });
});

describe('downsampleReadings', () => {
  it('averages each field per bucket, ignoring nulls', () => {
    const points = downsampleReadings(
      [
        row('2026-10-30T10:00:10Z', { tempC: 4, humidityPct: 80, rssi: -70 }),
        row('2026-10-30T10:02:00Z', { tempC: 6, humidityPct: null, rssi: -74 }),
        row('2026-10-30T10:04:59Z', { tempC: null, humidityPct: 90 }),
      ],
      FIVE_MIN,
    );

    expect(points).toEqual([
      {
        t: Date.parse('2026-10-30T10:00:00Z'),
        tempC: 5,
        humidityPct: 85,
        rssi: -72,
        snr: null,
        filteredRssi: null,
        count: 3,
        faults: 0,
      },
    ]);
  });

  it('aligns buckets to the UTC epoch', () => {
    const [p] = downsampleReadings([row('2026-10-30T10:07:30Z', { tempC: 1 })], FIVE_MIN);
    expect(p!.t).toBe(Date.parse('2026-10-30T10:05:00Z'));
  });

  it('counts non-zero error codes as faults per bucket and treats 0 and null as nominal', () => {
    const [p] = downsampleReadings(
      [
        row('2026-10-30T10:00:00Z', { errorCode: 100 }),
        row('2026-10-30T10:01:00Z', { errorCode: 0 }),
        row('2026-10-30T10:02:00Z', { errorCode: null }),
        row('2026-10-30T10:03:00Z', { errorCode: 201 }),
      ],
      FIVE_MIN,
    );
    expect(p).toMatchObject({ count: 4, faults: 2 });
  });

  it('omits empty buckets and sorts ascending regardless of input order', () => {
    const points = downsampleReadings(
      [row('2026-10-30T12:00:00Z', { tempC: 3 }), row('2026-10-30T10:00:00Z', { tempC: 1 })],
      FIVE_MIN,
    );
    expect(points.map((p) => p.tempC)).toEqual([1, 3]);
    expect(points).toHaveLength(2);
  });

  it('returns an empty list for no rows', () => {
    expect(downsampleReadings([], FIVE_MIN)).toEqual([]);
  });
});
