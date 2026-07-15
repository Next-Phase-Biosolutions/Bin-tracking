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

interface FakeStation {
    id: string;
    facilityId: string;
    token: string;
    label: string;
}

const store = vi.hoisted(() => {
    return {
        facilities: [] as FakeFacility[],
        stations: [] as FakeStation[],
        subscription: null as { plan: 'STARTER' | 'PRO' | 'ENTERPRISE' } | null,
        nextId: 0,
        nextStationId: 0,
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
        findFirst: ({ where }: { where: { id: string; organizationId: string } }) =>
            Promise.resolve(store.facilities.find((f) => f.id === where.id && f.organizationId === where.organizationId) ?? null),
    };
    const subscription = {
        findUnique: () => Promise.resolve(store.subscription),
    };
    const station = {
        create: ({ data }: { data: { facilityId: string; token: string; label: string } }) => {
            store.nextStationId += 1;
            const created: FakeStation = { id: `st-${store.nextStationId}`, ...data };
            store.stations.push(created);
            return Promise.resolve(created);
        },
    };

    return { prisma: { facility, subscription, station } };
});

const { facilityService } = await import('./facility.service.js');

beforeEach(() => {
    store.facilities = [];
    store.stations = [];
    store.subscription = null;
    store.nextId = 0;
    store.nextStationId = 0;
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

describe('facilityService.createStation — cross-org ownership', () => {
    it('creates a station when the facility belongs to the calling org', async () => {
        store.facilities.push({ id: 'fac-1', organizationId: 'org-a', name: 'HQ', deletedAt: null });

        const result = await facilityService.createStation('org-a', { facilityId: 'fac-1' });

        expect(result).toMatchObject({ facilityId: 'fac-1', label: 'Tablet' });
        expect(result?.token).toMatch(/^STN-/);
        expect(store.stations).toHaveLength(1);
    });

    it('rejects with NOT_FOUND when the facility belongs to a different org', async () => {
        store.facilities.push({ id: 'fac-1', organizationId: 'org-b', name: 'HQ', deletedAt: null });

        await expect(facilityService.createStation('org-a', { facilityId: 'fac-1' })).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
        expect(store.stations).toHaveLength(0);
    });

    it('rejects with NOT_FOUND when the facility does not exist at all', async () => {
        await expect(facilityService.createStation('org-a', { facilityId: 'fac-missing' })).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
        expect(store.stations).toHaveLength(0);
    });

    it('rejects with NOT_FOUND for a soft-deleted facility', async () => {
        store.facilities.push({ id: 'fac-1', organizationId: 'org-a', name: 'HQ', deletedAt: new Date() });

        await expect(facilityService.createStation('org-a', { facilityId: 'fac-1' })).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });

    it('uses the provided label when given', async () => {
        store.facilities.push({ id: 'fac-1', organizationId: 'org-a', name: 'HQ', deletedAt: null });

        const result = await facilityService.createStation('org-a', { facilityId: 'fac-1', label: 'Receiving Dock' });

        expect(result?.label).toBe('Receiving Dock');
    });
});
