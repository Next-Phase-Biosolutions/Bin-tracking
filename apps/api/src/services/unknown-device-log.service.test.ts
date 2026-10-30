import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the unknownSensorDeviceId calls unknown-device-log.service.ts makes.

interface FakeRow {
  externalId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  count: number;
}

const store = vi.hoisted(() => ({ rows: [] as FakeRow[] }));

vi.mock('@bin-tracker/db', () => ({
  prisma: {
    unknownSensorDeviceId: {
      deleteMany: ({ where }: { where: { lastSeenAt?: { lt: Date }; externalId?: { in: string[] } } }) => {
        const before = store.rows.length;
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
        update: { lastSeenAt: Date; count: { increment: number } };
        create: FakeRow;
      }) => {
        const existing = store.rows.find((r) => r.externalId === where.externalId);
        if (existing) {
          existing.lastSeenAt = update.lastSeenAt;
          existing.count += update.count.increment;
          return Promise.resolve(existing);
        }
        store.rows.push({ ...create });
        return Promise.resolve(create);
      },
      findMany: () => Promise.resolve([...store.rows].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())),
    },
  },
}));

const { unknownDeviceLog, UNKNOWN_ID_LOG_MAX_ROWS, UNKNOWN_ID_LOG_RETENTION_DAYS } = await import(
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
    expect(store.rows).toEqual([{ externalId: 'ghost-1', firstSeenAt: NOW, lastSeenAt: NOW, count: 1 }]);
  });

  it('increments count and moves lastSeenAt on a repeat, keeping firstSeenAt', async () => {
    const later = new Date(NOW.getTime() + 60_000);
    await unknownDeviceLog.record('ghost-1', NOW);
    await unknownDeviceLog.record('ghost-1', later);
    expect(store.rows).toEqual([{ externalId: 'ghost-1', firstSeenAt: NOW, lastSeenAt: later, count: 2 }]);
  });

  it('stores no payload: a row has exactly id, first seen, last seen and count', async () => {
    await unknownDeviceLog.record('ghost-1', NOW);
    expect(Object.keys(store.rows[0]!).sort()).toEqual(['count', 'externalId', 'firstSeenAt', 'lastSeenAt']);
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
