import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the shipment/facility queries shipment.service.ts actually uses.
//
// Regression focus: before this batch, list()/getById()/facilityOptions() had
// no organizationId filter at all — an authenticated user or station from
// any org could list, fetch by ID, or see the facility dropdown for another
// org's shipments/facilities.

interface FakeShipment {
    id: string;
    organizationId: string;
    shipmentCode: string;
    supplier: string;
    condition: 'GOOD' | 'DAMAGED';
    receivedAt: Date;
    facilityId: string | null;
}

interface FakeFacility {
    id: string;
    organizationId: string;
    name: string;
    deletedAt: Date | null;
}

const store = vi.hoisted(() => {
    return { shipments: [] as FakeShipment[], facilities: [] as FakeFacility[] };
});

vi.mock('@bin-tracker/db', () => {
    const shipment = {
        findMany: ({ where }: { where: { organizationId: string; condition?: string } }) =>
            Promise.resolve(
                store.shipments
                    .filter((s) => s.organizationId === where.organizationId && (!where.condition || s.condition === where.condition))
                    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
                    .map((s) => ({ ...s, facility: store.facilities.find((f) => f.id === s.facilityId) ?? null })),
            ),
        findUnique: ({ where }: { where: { id: string } }) => {
            const row = store.shipments.find((s) => s.id === where.id);
            if (!row) return Promise.resolve(null);
            return Promise.resolve({ ...row, facility: store.facilities.find((f) => f.id === row.facilityId) ?? null });
        },
    };
    const facility = {
        findMany: ({ where }: { where: { organizationId: string; deletedAt: null } }) =>
            Promise.resolve(
                store.facilities.filter((f) => f.organizationId === where.organizationId && f.deletedAt === where.deletedAt),
            ),
    };

    return { prisma: { shipment, facility } };
});

const { shipmentService } = await import('./shipment.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function makeShipment(overrides: Partial<FakeShipment>): FakeShipment {
    return {
        id: overrides.id ?? 'shp-1',
        organizationId: overrides.organizationId ?? ORG_A,
        shipmentCode: overrides.shipmentCode ?? 'SHP-1',
        supplier: overrides.supplier ?? 'Acme Foods',
        condition: overrides.condition ?? 'GOOD',
        receivedAt: overrides.receivedAt ?? new Date('2026-07-01T00:00:00.000Z'),
        facilityId: overrides.facilityId ?? null,
        ...overrides,
    };
}

beforeEach(() => {
    store.shipments = [];
    store.facilities = [];
});

describe('shipmentService.list', () => {
    it('only returns shipments belonging to the requesting org', async () => {
        store.shipments.push(
            makeShipment({ id: 'shp-a', organizationId: ORG_A }),
            makeShipment({ id: 'shp-b', organizationId: ORG_B }),
        );

        const result = await shipmentService.list(ORG_A, { limit: 50 });

        expect(result.map((s) => s.id)).toEqual(['shp-a']);
    });
});

describe('shipmentService.getById', () => {
    it('rejects with NOT_FOUND for a shipment in another org', async () => {
        store.shipments.push(makeShipment({ id: 'shp-b', organizationId: ORG_B }));

        await expect(shipmentService.getById(ORG_A, 'shp-b')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns the shipment when it belongs to the requesting org', async () => {
        store.shipments.push(makeShipment({ id: 'shp-a', organizationId: ORG_A }));

        const result = await shipmentService.getById(ORG_A, 'shp-a');

        expect(result.id).toBe('shp-a');
    });
});

describe('shipmentService.facilityOptions', () => {
    it('only returns facilities belonging to the requesting org', async () => {
        store.facilities.push(
            { id: 'fac-a', organizationId: ORG_A, name: 'Facility A', deletedAt: null },
            { id: 'fac-b', organizationId: ORG_B, name: 'Facility B', deletedAt: null },
        );

        const result = await shipmentService.facilityOptions(ORG_A);

        expect(result.map((f) => f.id)).toEqual(['fac-a']);
    });
});
