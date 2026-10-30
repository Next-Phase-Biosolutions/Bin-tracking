/**
 * The six zones every facility starts with (matching the sidebar that used to be
 * hard-coded in apps/web/src/lib/nav.ts). Platform admins can add, rename,
 * reorder and remove zones afterwards; the migration seeds these for facilities
 * that already exist, and `seedDefaultZones` covers newly created ones.
 */
export const DEFAULT_ZONES = [
    { slug: 'receiving', name: 'Receiving', icon: 'truck', sortOrder: 0 },
    { slug: 'killfloor', name: 'Kill Floor', icon: 'blade', sortOrder: 1 },
    { slug: 'processing', name: 'Processing', icon: 'knife', sortOrder: 2 },
    { slug: 'wetaging', name: 'Wet Aging', icon: 'snow', sortOrder: 3 },
    { slug: 'valueadd', name: 'Value Add', icon: 'box', sortOrder: 4 },
    { slug: 'shipping', name: 'Shipping', icon: 'ship', sortOrder: 5 },
] as const;

/** The slice of a Prisma client (or transaction client) `seedDefaultZones` needs. */
export interface ZoneSeedDb {
    zone: {
        createMany(args: {
            data: Array<{ facilityId: string; slug: string; name: string; icon: string; sortOrder: number }>;
            skipDuplicates: boolean;
        }): Promise<unknown>;
    };
}

/** Idempotent: re-running for a facility that already has zones adds only the missing slugs. */
export async function seedDefaultZones(db: ZoneSeedDb, facilityId: string): Promise<void> {
    await db.zone.createMany({
        data: DEFAULT_ZONES.map((zone) => ({ facilityId, ...zone })),
        skipDuplicates: true,
    });
}
