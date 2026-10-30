import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Covers only what facility.service.ts's create() uses: subscription lookup
// (plan quantity limit) + facility count/create.

interface FakeFacility {
    id: string;
    organizationId: string;
    name: string;
    deletedAt: Date | null;
}

const store = vi.hoisted(() => {
    return {
        facilities: [] as FakeFacility[],
        subscription: null as { plan: 'STARTER' | 'PRO' | 'ENTERPRISE' } | null,
        zones: [] as Array<{ facilityId: string; slug: string; name: string }>,
        nextId: 0,
    };
});

vi.mock('@bin-tracker/db', async () => {
    const facility = {
        count: ({ where }: { where: { organizationId: string; deletedAt: null } }) =>
            Promise.resolve(
                store.facilities.filter((f) => f.organizationId === where.organizationId && f.deletedAt === null).length,
            ),
        create: ({ data }: { data: { organizationId: string; name: string } }) => {
            store.nextId += 1;
            const created: FakeFacility = { id: `fac-${store.nextId}`, organizationId: data.organizationId, name: data.name, deletedAt: null };
            store.facilities.push(created);
            return Promise.resolve(created);
        },
        findFirst: ({ where }: { where: { id: string; organizationId: string } }) =>
            Promise.resolve(store.facilities.find((f) => f.id === where.id && f.organizationId === where.organizationId) ?? null),
    };
    const subscription = {
        findUnique: () => Promise.resolve(store.subscription),
    };

    const zone = {
        createMany: ({ data }: { data: Array<{ facilityId: string; slug: string; name: string }> }) => {
            store.zones.push(...data);
            return Promise.resolve({ count: data.length });
        },
    };
    const tx = { facility, zone };

    // The real seeding logic runs against the fake zone table (pure module, no Prisma client).
    const { seedDefaultZones } = await import('../../../../packages/db/src/default-zones.js');

    return {
        prisma: { facility, subscription, zone, $transaction: (cb: (client: typeof tx) => unknown) => cb(tx) },
        seedDefaultZones,
    };
});

const { facilityService } = await import('./facility.service.js');

beforeEach(() => {
    store.facilities = [];
    store.subscription = null;
    store.nextId = 0;
    store.zones = [];
});

describe('facilityService.create — plan quantity limit', () => {
    it('rejects with FORBIDDEN once the org is at its plan maxFacilities', async () => {
        store.subscription = { plan: 'STARTER' }; // maxFacilities: 1
        store.facilities.push({ id: 'fac-0', organizationId: 'org-a', name: 'Existing', deletedAt: null });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(facilityService.create('org-a', { name: 'New Facility' } as any)).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });

    it('allows creating under the limit', async () => {
        store.subscription = { plan: 'PRO' }; // maxFacilities: 5
        store.facilities.push({ id: 'fac-0', organizationId: 'org-a', name: 'Existing', deletedAt: null });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await facilityService.create('org-a', { name: 'New Facility' } as any);

        expect(result?.organizationId).toBe('org-a');
    });

    it('treats maxFacilities: -1 (ENTERPRISE) as unlimited', async () => {
        store.subscription = { plan: 'ENTERPRISE' };
        for (let i = 0; i < 50; i += 1) {
            store.facilities.push({ id: `fac-${i}`, organizationId: 'org-a', name: 'Existing', deletedAt: null });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await facilityService.create('org-a', { name: 'New Facility' } as any);

        expect(result?.organizationId).toBe('org-a');
    });

    it('does not count soft-deleted facilities against the limit', async () => {
        store.subscription = { plan: 'STARTER' }; // maxFacilities: 1
        store.facilities.push({ id: 'fac-0', organizationId: 'org-a', name: 'Deleted', deletedAt: new Date() });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await facilityService.create('org-a', { name: 'New Facility' } as any);

        expect(result?.organizationId).toBe('org-a');
    });
});

describe('facilityService.create — default zones', () => {
    it('seeds the six default zones for the new facility', async () => {
        store.subscription = { plan: 'ENTERPRISE' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created = await facilityService.create('org-a', { name: 'Fresh Plant' } as any);

        expect(store.zones.map((z) => z.slug)).toEqual([
            'receiving',
            'killfloor',
            'processing',
            'wetaging',
            'valueadd',
            'shipping',
        ]);
        expect(store.zones.every((z) => z.facilityId === created.id)).toBe(true);
    });
});
