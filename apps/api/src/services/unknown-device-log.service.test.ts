import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the unknownSensorDeviceId calls unknown-device-log.service.ts makes.

interface FakeRow {
  externalId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  count: number;
  lastTempC?: number | null;
  lastHumidityPct?: number | null;
  lastRawExcerpt?: string | null;
}

const store = vi.hoisted(() => ({ rows: [] as FakeRow[] }));

vi.mock('@bin-tracker/db', () => ({
  prisma: {
    unknownSensorDeviceId: {
      deleteMany: ({ where }: { where?: { lastSeenAt?: { lt: Date }; externalId?: { in: string[] } } } = {}) => {
        const before = store.rows.length;
        if (!where) store.rows = [];
        else
        store.rows = store.rows.filter((r) => {
          if (where.lastSeenAt && r.lastSeenAt < where.lastSeenAt.lt) return false;
          if (where.externalId && where.externalId.in.includes(r.externalId)) return false;
          return true;
        });
        return Promise.resolve({ count: before - store.rows.length });
      },
      findUnique: ({ where }: { where: { externalId: string } }) =>
        Promise.resolve(store.rows.find((r) => r.externalId === where.externalId) ?? null),
      count: () => Promise.resolve(store.rows.length),
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { externalId: string };
        update: Partial<FakeRow> & { count: { increment: number } };
        create: FakeRow;
      }) => {
        const existing = store.rows.find((r) => r.externalId === where.externalId);
        if (existing) {
          const { count, ...rest } = update;
          Object.assign(existing, rest);
          existing.count += count.increment;
          return Promise.resolve(existing);
        }
        store.rows.push({ ...create });
        return Promise.resolve(create);
      },
      findMany: () => Promise.resolve([...store.rows].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())),
    },
  },
}));

const { unknownDeviceLog, UNKNOWN_ID_LOG_MAX_ROWS, UNKNOWN_ID_LOG_RETENTION_DAYS, UNKNOWN_ID_SAMPLE_EXCERPT_CHARS } = await import(
  './unknown-device-log.service.js'
);

const NOW = new Date('2026-10-30T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  store.rows = [];
});

describe('unknownDeviceLog.record', () => {
  it('logs a first sighting with count 1 and equal first/last seen', async () => {
    await unknownDeviceLog.record('ghost-1', NOW);
    expect(store.rows).toMatchObject([{ externalId: 'ghost-1', firstSeenAt: NOW, lastSeenAt: NOW, count: 1 }]);
  });

  it('increments count and moves lastSeenAt on a repeat, keeping firstSeenAt', async () => {
    const later = new Date(NOW.getTime() + 60_000);
    await unknownDeviceLog.record('ghost-1', NOW);
    await unknownDeviceLog.record('ghost-1', later);
    expect(store.rows).toMatchObject([{ externalId: 'ghost-1', firstSeenAt: NOW, lastSeenAt: later, count: 2 }]);
  });

  it('stores no sample for an id sent without one', async () => {
    await unknownDeviceLog.record('ghost-1', NOW);
    expect(store.rows[0]).toMatchObject({ lastTempC: null, lastHumidityPct: null, lastRawExcerpt: null });
  });

  it('keeps the latest small sample: temperature, humidity and a capped excerpt of p_raw', async () => {
    const big = { note: 'x'.repeat(5000) };
    await unknownDeviceLog.record('ghost-1', NOW, { tempC: 3.2, humidityPct: 71, raw: { fw: '1.0' } });
    expect(store.rows[0]).toMatchObject({ lastTempC: 3.2, lastHumidityPct: 71, lastRawExcerpt: '{"fw":"1.0"}' });

    await unknownDeviceLog.record('ghost-1', NOW, { tempC: null, humidityPct: undefined, raw: big });
    expect(store.rows[0]!.lastTempC).toBeNull();
    expect(store.rows[0]!.lastRawExcerpt!.length).toBe(UNKNOWN_ID_SAMPLE_EXCERPT_CHARS);
  });

  it(`prunes rows not seen for ${UNKNOWN_ID_LOG_RETENTION_DAYS} days on write`, async () => {
    store.rows = [
      { externalId: 'stale', firstSeenAt: new Date(NOW.getTime() - 31 * DAY_MS), lastSeenAt: new Date(NOW.getTime() - 31 * DAY_MS), count: 4 },
      { externalId: 'fresh', firstSeenAt: new Date(NOW.getTime() - 29 * DAY_MS), lastSeenAt: new Date(NOW.getTime() - 29 * DAY_MS), count: 1 },
    ];
    await unknownDeviceLog.record('ghost-1', NOW);
    expect(store.rows.map((r) => r.externalId).sort()).toEqual(['fresh', 'ghost-1']);
  });

  it(`stops adding new ids at ${UNKNOWN_ID_LOG_MAX_ROWS} rows but still increments existing ones`, async () => {
    store.rows = Array.from({ length: UNKNOWN_ID_LOG_MAX_ROWS }, (_, i) => ({
      externalId: `id-${i}`,
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      count: 1,
    }));
    await unknownDeviceLog.record('brand-new', NOW);
    expect(store.rows).toHaveLength(UNKNOWN_ID_LOG_MAX_ROWS);
    expect(store.rows.some((r) => r.externalId === 'brand-new')).toBe(false);

    await unknownDeviceLog.record('id-5', NOW);
    expect(store.rows.find((r) => r.externalId === 'id-5')!.count).toBe(2);
  });
});

describe('unknownDeviceLog.list / forget', () => {
  it('lists newest-seen first', async () => {
    await unknownDeviceLog.record('older', NOW);
    await unknownDeviceLog.record('newer', new Date(NOW.getTime() + 1000));
    expect((await unknownDeviceLog.list()).map((r) => r.externalId)).toEqual(['newer', 'older']);
  });

  it('forget removes the given ids and nothing else', async () => {
    await unknownDeviceLog.record('a', NOW);
    await unknownDeviceLog.record('b', NOW);
    await unknownDeviceLog.forget(['a']);
    expect(store.rows.map((r) => r.externalId)).toEqual(['b']);
  });
});

describe('unknownDeviceLog.dismiss / clear', () => {
  it('dismiss removes only the given ids', async () => {
    for (const id of ['a', 'b', 'c']) await unknownDeviceLog.record(id, NOW);
    await unknownDeviceLog.dismiss(['a', 'c']);
    expect(store.rows.map((r) => r.externalId)).toEqual(['b']);
  });

  it('clear empties the log so a flood of junk ids cannot keep real ones out', async () => {
    store.rows = Array.from({ length: UNKNOWN_ID_LOG_MAX_ROWS }, (_, i) => ({
      externalId: `junk-${i}`, firstSeenAt: NOW, lastSeenAt: NOW, count: 1,
    }));
    await unknownDeviceLog.clear();
    expect(store.rows).toHaveLength(0);
    await unknownDeviceLog.record('real-device', NOW);
    expect(store.rows.map((r) => r.externalId)).toEqual(['real-device']);
  });
});
