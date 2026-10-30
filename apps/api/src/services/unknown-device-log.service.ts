import { prisma } from '@bin-tracker/db';

/** Hard cap on distinct ids kept; a flood of random ids can't grow the table. */
export const UNKNOWN_ID_LOG_MAX_ROWS = 1000;
/** Rows not seen for this long are pruned on the next write (no scheduler exists). */
export const UNKNOWN_ID_LOG_RETENTION_DAYS = 30;

/** Longest slice of the last p_raw kept per unknown id, so an admin can tell test devices apart. */
export const UNKNOWN_ID_SAMPLE_EXCERPT_CHARS = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the latest request from an unknown id carried. Admin-only; never reaches a tenant response. */
export interface UnknownIdSample {
  tempC?: number | null;
  humidityPct?: number | null;
  raw?: unknown;
}

function sampleColumns(sample?: UnknownIdSample) {
  const raw = sample?.raw === undefined ? null : JSON.stringify(sample.raw);
  return {
    lastTempC: sample?.tempC ?? null,
    lastHumidityPct: sample?.humidityPct ?? null,
    lastRawExcerpt: raw === null ? null : raw.slice(0, UNKNOWN_ID_SAMPLE_EXCERPT_CHARS),
  };
}

/**
 * Ids that arrived with a valid ingest key but match no registered device, so a
 * platform admin can spot typos in the vendor's list or tell test devices apart.
 * Stores the id, counts and a small sample of the latest request (temperature,
 * humidity, a capped excerpt of p_raw) — never the whole payload.
 */
export const unknownDeviceLog = {
  async record(externalId: string, now: Date = new Date(), sample?: UnknownIdSample): Promise<void> {
    await prisma.unknownSensorDeviceId.deleteMany({
      where: { lastSeenAt: { lt: new Date(now.getTime() - UNKNOWN_ID_LOG_RETENTION_DAYS * DAY_MS) } },
    });

    const existing = await prisma.unknownSensorDeviceId.findUnique({ where: { externalId } });
    if (!existing && (await prisma.unknownSensorDeviceId.count()) >= UNKNOWN_ID_LOG_MAX_ROWS) return;

    // upsert, not create: two first sightings of one id can race.
    const columns = sampleColumns(sample);
    await prisma.unknownSensorDeviceId.upsert({
      where: { externalId },
      update: { lastSeenAt: now, count: { increment: 1 }, ...columns },
      create: { externalId, firstSeenAt: now, lastSeenAt: now, count: 1, ...columns },
    });
  },

  list() {
    return prisma.unknownSensorDeviceId.findMany({ orderBy: { lastSeenAt: 'desc' } });
  },

  /** Drops ids that have since been registered. */
  async forget(externalIds: string[]): Promise<void> {
    if (externalIds.length === 0) return;
    await prisma.unknownSensorDeviceId.deleteMany({ where: { externalId: { in: externalIds } } });
  },

  /** An admin dismissing junk entries (typos, stray test ids); they reappear only if the device sends again. */
  async dismiss(externalIds: string[]): Promise<void> {
    await this.forget(externalIds);
  },

  /** An admin emptying the whole log, e.g. after a flood of junk ids filled the cap. */
  async clear(): Promise<void> {
    await prisma.unknownSensorDeviceId.deleteMany({});
  },
};
