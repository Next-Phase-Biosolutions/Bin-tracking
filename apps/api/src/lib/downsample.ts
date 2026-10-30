/** Bucket width per chart range: 24h -> 5 min, 7d -> 30 min, 30d -> 2 h (keeps a chart to a few hundred points). */
export const BUCKET_MS = { '24h': 300_000, '7d': 1_800_000, '30d': 7_200_000 } as const;

export interface DownsampleRow {
  timestamp: Date;
  tempC: number | null;
  humidityPct: number | null;
  rssi: number | null;
  snr: number | null;
  filteredRssi: number | null;
  errorCode: number | null;
}

export interface AdminSeriesPoint {
  /** Bucket start, epoch milliseconds. */
  t: number;
  tempC: number | null;
  humidityPct: number | null;
  rssi: number | null;
  snr: number | null;
  filteredRssi: number | null;
  /** Readings that fell in the bucket. */
  count: number;
  /** Readings in the bucket with a non-zero error code. */
  faults: number;
}

const FIELDS = ['tempC', 'humidityPct', 'rssi', 'snr', 'filteredRssi'] as const;

/**
 * Averages readings into fixed buckets aligned to the UTC epoch. Each field is
 * averaged over its non-null values only (null when a bucket has none), empty
 * buckets are omitted, and the result is ascending by bucket start.
 */
export function downsampleReadings(rows: readonly DownsampleRow[], bucketMs: number): AdminSeriesPoint[] {
  const buckets = new Map<number, DownsampleRow[]>();
  for (const row of rows) {
    const start = Math.floor(row.timestamp.getTime() / bucketMs) * bucketMs;
    const bucket = buckets.get(start);
    if (bucket) bucket.push(row);
    else buckets.set(start, [row]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, bucket]) => {
      const point: AdminSeriesPoint = {
        t,
        tempC: null,
        humidityPct: null,
        rssi: null,
        snr: null,
        filteredRssi: null,
        count: bucket.length,
        faults: bucket.filter((r) => r.errorCode !== null && r.errorCode !== 0).length,
      };
      for (const field of FIELDS) {
        const values = bucket.map((r) => r[field]).filter((v): v is number => v !== null);
        point[field] = values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
      }
      return point;
    });
}
