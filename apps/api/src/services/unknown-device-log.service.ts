import { prisma } from '@bin-tracker/db';

/** Hard cap on distinct ids kept; a flood of random ids can't grow the table. */
export const UNKNOWN_ID_LOG_MAX_ROWS = 1000;
/** Rows not seen for this long are pruned on the next write (no scheduler exists). */
export const UNKNOWN_ID_LOG_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ids that arrived with a valid ingest key but match no registered device, so a
 * platform admin can spot typos in the vendor's list. Stores the id and counts
 * only — never the payload.
 */
export const unknownDeviceLog = {
  async record(externalId: string, now: Date = new Date()): Promise<void> {
    await prisma.unknownSensorDeviceId.deleteMany({
      where: { lastSeenAt: { lt: new Date(now.getTime() - UNKNOWN_ID_LOG_RETENTION_DAYS * DAY_MS) } },
    });

    const existing = await prisma.unknownSensorDeviceId.findUnique({ where: { externalId } });
    if (!existing && (await prisma.unknownSensorDeviceId.count()) >= UNKNOWN_ID_LOG_MAX_ROWS) return;

    // upsert, not create: two first sightings of one id can race.
    await prisma.unknownSensorDeviceId.upsert({
      where: { externalId },
      update: { lastSeenAt: now, count: { increment: 1 } },
      create: { externalId, firstSeenAt: now, lastSeenAt: now, count: 1 },
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
};
