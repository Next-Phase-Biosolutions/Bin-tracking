import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the queries cycle.service.ts's pickup/deliver actually use.
// Focus: cross-org access must read as NOT_FOUND, never FORBIDDEN — a caller
// must not be able to distinguish "doesn't exist" from "exists but isn't
// yours" via error code.

type CycleStatus = 'ACTIVE' | 'IN_TRANSIT' | 'COMPLETED';

interface FakeCycle {
    id: string;
    organizationId: string;
    binId: string;
    facilityId: string;
    destinationId: string | null;
    status: CycleStatus;
    startedAt: Date;
    deadline: Date;
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
    driverId: string | null;
    vehicleId: string | null;
    complianceResult: string | null;
}

interface FakeFacility {
    id: string;
    organizationId: string;
    type: 'PROCESSING' | 'RENDERING';
    deletedAt: Date | null;
}

const store = vi.hoisted(() => {
    return {
        cycles: [] as FakeCycle[],
        facilities: [] as FakeFacility[],
        events: [] as unknown[],
        seq: 0,
    };
});

function nextId(prefix: string): string {
    store.seq += 1;
    return `${prefix}-${store.seq}`;
}

const fakePrisma = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('@bin-tracker/db', () => {
    const binCycle = {
        findUnique: ({ where }: { where: { id: string } }) => {
            const cycle = store.cycles.find((c) => c.id === where.id);
            return Promise.resolve(cycle ? { ...cycle } : null);
        },
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeCycle> }) => {
            const cycle = store.cycles.find((c) => c.id === where.id);
            if (!cycle) throw new Error('cycle not found');
            Object.assign(cycle, data);
            return Promise.resolve({ ...cycle });
        },
    };
    const bin = {
        update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
            Promise.resolve({ id: where.id, ...data }),
    };
    const facility = {
        findFirst: ({ where }: { where: { id: string; organizationId: string } }) => {
            const match = store.facilities.find(
                (f) => f.id === where.id && f.organizationId === where.organizationId,
            );
            return Promise.resolve(match ? { ...match } : null);
        },
    };
    const userFacility = {
        // Only reached for non-ADMIN roles; tests exercise ADMIN so this is unused.
        findUnique: () => Promise.resolve(null),
    };
    const eventLog = {
        create: ({ data }: { data: Record<string, unknown> }) => {
            store.events.push(data);
            return Promise.resolve({ id: nextId('evt'), ...data });
        },
    };

    Object.assign(fakePrisma, {
        binCycle,
        bin,
        facility,
        userFacility,
        eventLog,
        $transaction: (cb: (tx: unknown) => unknown) => Promise.resolve(cb(fakePrisma)),
    });

    return { prisma: fakePrisma };
});

// Import AFTER the mock is registered.
const { cycleService } = await import('./cycle.service.js');

function seedCycle(overrides: Partial<FakeCycle> = {}): FakeCycle {
    const cycle: FakeCycle = {
        id: nextId('cycle'),
        organizationId: 'org-1',
        binId: nextId('bin'),
        facilityId: 'fac-source',
        destinationId: null,
        status: 'ACTIVE',
        startedAt: new Date(),
        deadline: new Date(Date.now() + 60 * 60 * 1000),
        pickedUpAt: null,
        deliveredAt: null,
        driverId: null,
        vehicleId: null,
        complianceResult: null,
        ...overrides,
    };
    store.cycles.push(cycle);
    return cycle;
}

function seedFacility(overrides: Partial<FakeFacility> = {}): FakeFacility {
    const facility: FakeFacility = {
        id: nextId('fac'),
        organizationId: 'org-1',
        type: 'RENDERING',
        deletedAt: null,
        ...overrides,
    };
    store.facilities.push(facility);
    return facility;
}

describe('cycleService — cross-org isolation', () => {
    beforeEach(() => {
        store.cycles.length = 0;
        store.facilities.length = 0;
        store.events.length = 0;
        store.seq = 0;
    });

    it('pickup: throws NOT_FOUND (never FORBIDDEN) when the cycle belongs to another org', async () => {
        const cycle = seedCycle({ organizationId: 'org-2', status: 'ACTIVE' });

        await expect(
            cycleService.pickup('org-1', { cycleId: cycle.id, vehicleId: 'v1' }, 'admin-1', 'ADMIN'),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });

        // The other org's cycle is untouched by the rejected attempt.
        expect(store.cycles.find((c) => c.id === cycle.id)?.status).toBe('ACTIVE');
    });

    it('pickup: succeeds when the cycle belongs to the caller org', async () => {
        const cycle = seedCycle({ organizationId: 'org-1', status: 'ACTIVE' });

        const result = await cycleService.pickup('org-1', { cycleId: cycle.id, vehicleId: 'v1' }, 'admin-1', 'ADMIN');

        expect(result?.status).toBe('IN_TRANSIT');
    });

    it('deliver: throws NOT_FOUND (never FORBIDDEN) when the cycle belongs to another org', async () => {
        const cycle = seedCycle({ organizationId: 'org-2', status: 'IN_TRANSIT', driverId: 'admin-1' });
        const destination = seedFacility({ organizationId: 'org-2', type: 'RENDERING' });

        await expect(
            cycleService.deliver('org-1', { cycleId: cycle.id, destinationId: destination.id }, 'admin-1', 'ADMIN'),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('deliver: throws NOT_FOUND when the destination facility belongs to another org', async () => {
        const cycle = seedCycle({ organizationId: 'org-1', status: 'IN_TRANSIT', driverId: 'admin-1' });
        const destination = seedFacility({ organizationId: 'org-2', type: 'RENDERING' });

        await expect(
            cycleService.deliver('org-1', { cycleId: cycle.id, destinationId: destination.id }, 'admin-1', 'ADMIN'),
        ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Destination facility not found' });
    });

    it('deliver: succeeds when the cycle and destination share the caller org', async () => {
        const cycle = seedCycle({ organizationId: 'org-1', status: 'IN_TRANSIT', driverId: 'admin-1' });
        const destination = seedFacility({ organizationId: 'org-1', type: 'RENDERING' });

        const result = await cycleService.deliver(
            'org-1',
            { cycleId: cycle.id, destinationId: destination.id },
            'admin-1',
            'ADMIN',
        );

        expect(result?.status).toBe('COMPLETED');
    });
});
