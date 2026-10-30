import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { CreateZoneInput } from '@bin-tracker/validators';

export interface ZoneSummary {
    id: string;
    slug: string;
    name: string;
    icon: string;
    sortOrder: number;
    facilityId: string;
    facilityName: string;
}

/**
 * URL-safe slug from a zone name: lowercase letters and digits only. Appends
 * -2, -3, … until it is not in `taken`, so "Wet-Aging" next to an existing
 * `wetaging` gets its own slug instead of tripping the (facilityId, slug) key.
 */
export function slugifyZoneName(name: string, taken: ReadonlySet<string>): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'zone';
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
}

type ZoneRow = {
    id: string;
    slug: string;
    name: string;
    icon: string;
    sortOrder: number;
    facilityId: string;
    facility: { name: string };
};

function toSummary(zone: ZoneRow): ZoneSummary {
    return {
        id: zone.id,
        slug: zone.slug,
        name: zone.name,
        icon: zone.icon,
        sortOrder: zone.sortOrder,
        facilityId: zone.facilityId,
        facilityName: zone.facility.name,
    };
}

const FACILITY_NAME = { facility: { select: { name: true } } } as const;

export const zoneService = {
    async listForFacilities(facilityIds: string[]): Promise<ZoneSummary[]> {
        const zones = await prisma.zone.findMany({
            where: { facilityId: { in: facilityIds }, facility: { deletedAt: null } },
            include: FACILITY_NAME,
            orderBy: [{ facility: { name: 'asc' } }, { sortOrder: 'asc' }],
        });
        return zones.map(toSummary);
    },

    async listForFacility(facilityId: string): Promise<ZoneSummary[]> {
        const zones = await prisma.zone.findMany({
            where: { facilityId },
            include: FACILITY_NAME,
            orderBy: { sortOrder: 'asc' },
        });
        return zones.map(toSummary);
    },

    async create(input: CreateZoneInput): Promise<ZoneSummary> {
        const facility = await prisma.facility.findFirst({ where: { id: input.facilityId, deletedAt: null } });
        if (!facility) throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });

        const existing = await prisma.zone.findMany({ where: { facilityId: input.facilityId } });
        const slug = slugifyZoneName(input.name, new Set(existing.map((z) => z.slug)));
        const sortOrder = existing.reduce((max, z) => Math.max(max, z.sortOrder), -1) + 1;

        const created = await prisma.zone.create({
            data: { facilityId: input.facilityId, slug, name: input.name, icon: input.icon, sortOrder },
            include: FACILITY_NAME,
        });
        return toSummary(created);
    },

    /** The slug never changes, so bookmarked /app/zones/<slug> links keep working. */
    async rename(zoneId: string, name: string): Promise<ZoneSummary> {
        const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
        if (!zone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Zone not found' });
        const updated = await prisma.zone.update({ where: { id: zoneId }, data: { name }, include: FACILITY_NAME });
        return toSummary(updated);
    },

    async reorder(facilityId: string, zoneIds: string[]): Promise<void> {
        const zones = await prisma.zone.findMany({ where: { facilityId } });
        const known = new Set(zones.map((z) => z.id));
        const given = new Set(zoneIds);
        // Exactly this facility's zones, each once: a partial or foreign list would leave sortOrder inconsistent.
        if (given.size !== zoneIds.length || given.size !== known.size || zoneIds.some((id) => !known.has(id))) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: "zoneIds must list every zone of the facility exactly once" });
        }
        await prisma.$transaction(
            zoneIds.map((id, index) => prisma.zone.update({ where: { id }, data: { sortOrder: index } })),
        );
    },

    async remove(zoneId: string): Promise<void> {
        const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
        if (!zone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Zone not found' });
        const devices = await prisma.sensorDevice.count({ where: { zoneId } });
        if (devices > 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Zone has assigned devices — reassign them first' });
        }
        await prisma.zone.delete({ where: { id: zoneId } });
    },
};
