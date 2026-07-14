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
        nextId: 0,
    };
});

vi.mock('@bin-tracker/db', () => {
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
    };
    const subscription = {
        findUnique: () => Promise.resolve(store.subscription),
    };

    return { prisma: { facility, subscription } };
});

const { facilityService } = await import('./facility.service.js');

beforeEach(() => {
    store.facilities = [];
    store.subscription = null;
    store.nextId = 0;
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
