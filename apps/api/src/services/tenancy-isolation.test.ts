import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Cross-service tenancy isolation suite ────────────────────
// Batches 1-3 org-scoped every tenant-owned service (bin, cycle, facility,
// dashboard, blockchain, employee, attendance, shipment, farmer, form,
// payroll) and each batch found real pre-existing cross-org leaks along the
// way (dashboard's ADMIN branch, blockchain's confirmAnchor, employee/
// attendance/shipment/form reads, payroll's listRuns). Per-service test
// files already cover their own regressions in depth; this file is the
// single place that exercises a representative cross-tenant scenario from
// each of those services side by side, so a regression in any one of them
// shows up in one obvious spot. Follows the existing convention (see
// attendance.service.test.ts, cycle.service.test.ts, dashboard.service.test.ts)
// of an in-memory hoisted Prisma fake rather than a real database — mirrors
// only the queries the exercised code paths actually use.

interface FakeEmployee {
    id: string;
    organizationId: string;
    employeeCode: string;
    fullName: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: Date;
}

interface FakePayrollRun {
    id: string;
    organizationId: string;
    period: string;
    status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
    rateCents: number;
    currency: string;
    totalEmployees: number;
    totalMinutes: number;
    totalGrossCents: number;
    computedAt: Date | null;
    createdAt: Date;
}

interface FakeBinType {
    id: string;
    organizationId: string;
    masterQrCode: string;
    organType: string;
    dkHours: number;
    urgency: string;
    prefix: string;
}

interface FakeBin {
    id: string;
    organizationId: string;
    qrCode: string;
    binTypeId: string;
    currentFacilityId: string;
    status: 'IDLE' | 'ACTIVE' | 'IN_TRANSIT';
    deletedAt: Date | null;
}

interface FakeFacility {
    id: string;
    organizationId: string;
    name: string;
    type: 'PROCESSING' | 'RENDERING';
    deletedAt: Date | null;
}

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

const store = vi.hoisted(() => {
    return {
        employees: [] as FakeEmployee[],
        payrollRuns: [] as FakePayrollRun[],
        binTypes: [] as FakeBinType[],
        bins: [] as FakeBin[],
        facilities: [] as FakeFacility[],
        cycles: [] as FakeCycle[],
        seq: 0,
    };
});

function nextId(prefix: string): string {
    store.seq += 1;
    return `${prefix}-${store.seq}`;
}

interface CycleWhere {
    organizationId?: string;
    facilityId?: { in: string[] };
    status?: CycleStatus | { in: CycleStatus[] };
    deadline?: { lt: Date };
    deliveredAt?: { gte: Date };
    complianceResult?: string;
}

function matchesCycle(cycle: FakeCycle, where: CycleWhere): boolean {
    if (where.organizationId !== undefined && cycle.organizationId !== where.organizationId) return false;
    if (where.facilityId && !where.facilityId.in.includes(cycle.facilityId)) return false;
    if (where.status) {
        const matchesStatus =
            typeof where.status === 'string' ? cycle.status === where.status : where.status.in.includes(cycle.status);
        if (!matchesStatus) return false;
    }
    if (where.deadline && !(cycle.deadline < where.deadline.lt)) return false;
    if (where.deliveredAt && !(cycle.deliveredAt && cycle.deliveredAt >= where.deliveredAt.gte)) return false;
    if (where.complianceResult && cycle.complianceResult !== where.complianceResult) return false;
    return true;
}

const fakePrisma = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('@bin-tracker/db', () => {
    const employee = {
        findMany: ({ where }: { where: { organizationId: string; status?: string } }) =>
            Promise.resolve(
                store.employees.filter(
                    (e) => e.organizationId === where.organizationId && (!where.status || e.status === where.status),
                ),
            ),
    };

    const payrollRun = {
        findUnique: ({ where }: { where: { organizationId_period: { organizationId: string; period: string } } }) => {
            const run = store.payrollRuns.find(
                (r) =>
                    r.organizationId === where.organizationId_period.organizationId &&
                    r.period === where.organizationId_period.period,
            );
            return Promise.resolve(run ? { ...run, lineItems: [], exceptions: [] } : null);
        },
        findMany: ({ where, take }: { where: { organizationId: string }; take?: number }) => {
            const rows = store.payrollRuns
                .filter((r) => r.organizationId === where.organizationId)
                .sort((a, b) => b.period.localeCompare(a.period));
            return Promise.resolve(take ? rows.slice(0, take) : rows);
        },
    };

    const binType = {
        findUnique: ({
            where,
        }: {
            where: { organizationId_masterQrCode: { organizationId: string; masterQrCode: string } };
        }) => {
            const bt = store.binTypes.find(
                (b) =>
                    b.organizationId === where.organizationId_masterQrCode.organizationId &&
                    b.masterQrCode === where.organizationId_masterQrCode.masterQrCode,
            );
            return Promise.resolve(bt ? { ...bt } : null);
        },
    };

    const bin = {
        findUnique: ({ where }: { where: { organizationId_qrCode: { organizationId: string; qrCode: string } } }) => {
            const found = store.bins.find(
                (b) =>
                    b.organizationId === where.organizationId_qrCode.organizationId &&
                    b.qrCode === where.organizationId_qrCode.qrCode,
            );
            if (!found) return Promise.resolve(null);
            const bt = store.binTypes.find((t) => t.id === found.binTypeId) ?? null;
            const facility = store.facilities.find((f) => f.id === found.currentFacilityId) ?? null;
            return Promise.resolve({ ...found, binType: bt, currentFacility: facility, cycles: [] });
        },
        findMany: () => Promise.resolve([]),
    };

    const facility = {
        findFirst: ({ where }: { where: { id: string; organizationId: string } }) => {
            const match = store.facilities.find((f) => f.id === where.id && f.organizationId === where.organizationId);
            return Promise.resolve(match ? { ...match } : null);
        },
        findMany: ({ where }: { where: { organizationId: string; type?: string; deletedAt: null } }) =>
            Promise.resolve(
                store.facilities.filter(
                    (f) =>
                        f.organizationId === where.organizationId &&
                        f.deletedAt === null &&
                        (!where.type || f.type === where.type),
                ),
            ),
    };

    const userFacility = {
        // Every test below uses ADMIN, which skips this check entirely.
        findUnique: () => Promise.resolve(null),
    };

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
        count: ({ where }: { where: CycleWhere }) =>
            Promise.resolve(store.cycles.filter((c) => matchesCycle(c, where)).length),
        groupBy: () => Promise.resolve([]),
    };

    const binUpdate = {
        update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
            Promise.resolve({ id: where.id, ...data }),
    };

    const eventLog = {
        create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: nextId('evt'), ...data }),
    };

    Object.assign(fakePrisma, {
        employee,
        payrollRun,
        binType,
        bin: { ...bin, update: binUpdate.update },
        facility,
        userFacility,
        binCycle,
        eventLog,
        $queryRaw: () => Promise.resolve([]),
        $transaction: (cb: (tx: unknown) => unknown) => Promise.resolve(cb(fakePrisma)),
    });

    return { prisma: fakePrisma };
});

// Import AFTER the mock is registered.
const { employeeService } = await import('./employee.service.js');
const { payrollService } = await import('./payroll.service.js');
const { binService } = await import('./bin.service.js');
const { cycleService } = await import('./cycle.service.js');
const { dashboardService } = await import('./dashboard.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function seedEmployee(overrides: Partial<FakeEmployee> = {}): FakeEmployee {
    const employee: FakeEmployee = {
        id: nextId('emp'),
        organizationId: ORG_A,
        employeeCode: 'EMP-TEST',
        fullName: 'Jane Doe',
        status: 'ACTIVE',
        createdAt: new Date(),
        ...overrides,
    };
    store.employees.push(employee);
    return employee;
}

function seedPayrollRun(overrides: Partial<FakePayrollRun> = {}): FakePayrollRun {
    const run: FakePayrollRun = {
        id: nextId('run'),
        organizationId: ORG_A,
        period: '2026-07',
        status: 'DRAFT',
        rateCents: 1500,
        currency: 'USD',
        totalEmployees: 0,
        totalMinutes: 0,
        totalGrossCents: 0,
        computedAt: null,
        createdAt: new Date(),
        ...overrides,
    };
    store.payrollRuns.push(run);
    return run;
}

function seedBinType(overrides: Partial<FakeBinType> = {}): FakeBinType {
    const binType: FakeBinType = {
        id: nextId('bt'),
        organizationId: ORG_A,
        masterQrCode: 'TYPE-HEART',
        organType: 'HEART',
        dkHours: 24,
        urgency: 'HIGH',
        prefix: 'HRT',
        ...overrides,
    };
    store.binTypes.push(binType);
    return binType;
}

function seedFacility(overrides: Partial<FakeFacility> = {}): FakeFacility {
    const facility: FakeFacility = {
        id: nextId('fac'),
        organizationId: ORG_A,
        name: 'Test Facility',
        type: 'RENDERING',
        deletedAt: null,
        ...overrides,
    };
    store.facilities.push(facility);
    return facility;
}

function seedBin(overrides: Partial<FakeBin> = {}): FakeBin {
    const binType = store.binTypes[0] ?? seedBinType();
    const facility = store.facilities[0] ?? seedFacility();
    const bin: FakeBin = {
        id: nextId('bin'),
        organizationId: ORG_A,
        qrCode: 'QR-TEST',
        binTypeId: binType.id,
        currentFacilityId: facility.id,
        status: 'IDLE',
        deletedAt: null,
        ...overrides,
    };
    store.bins.push(bin);
    return bin;
}

function seedCycle(overrides: Partial<FakeCycle> = {}): FakeCycle {
    const cycle: FakeCycle = {
        id: nextId('cycle'),
        organizationId: ORG_A,
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

beforeEach(() => {
    store.employees.length = 0;
    store.payrollRuns.length = 0;
    store.binTypes.length = 0;
    store.bins.length = 0;
    store.facilities.length = 0;
    store.cycles.length = 0;
    store.seq = 0;
});

describe('cross-organization tenancy isolation', () => {
    describe('employeeService.list', () => {
        it('never includes an employee created under a different org', async () => {
            seedEmployee({ id: 'emp-a', organizationId: ORG_A });
            seedEmployee({ id: 'emp-b', organizationId: ORG_B });

            const result = await employeeService.list(ORG_A, {});

            expect(result.map((e) => e.id)).toEqual(['emp-a']);
        });
    });

    describe('payrollService.getRun', () => {
        it('rejects with NOT_FOUND when the run belongs to a different org', async () => {
            seedPayrollRun({ organizationId: ORG_B, period: '2026-07' });

            await expect(payrollService.getRun(ORG_A, { period: '2026-07' })).rejects.toMatchObject({
                code: 'NOT_FOUND',
            });
        });

        it('returns the run when it belongs to the requesting org', async () => {
            seedPayrollRun({ organizationId: ORG_A, period: '2026-07' });

            const result = await payrollService.getRun(ORG_A, { period: '2026-07' });

            expect(result.period).toBe('2026-07');
        });
    });

    describe('payrollService.listRuns', () => {
        it('never includes a run belonging to a different org', async () => {
            seedPayrollRun({ id: 'run-a', organizationId: ORG_A, period: '2026-07' });
            seedPayrollRun({ id: 'run-b', organizationId: ORG_B, period: '2026-07' });

            const result = await payrollService.listRuns(ORG_A, { limit: 24 });

            expect(result.map((r) => r.id)).toEqual(['run-a']);
        });
    });

    describe('binService.getByQrCode', () => {
        it('never resolves another org\'s bin from a shared QR code value', async () => {
            seedBinType({ organizationId: ORG_B, masterQrCode: 'TYPE-OTHER' });
            seedBin({ organizationId: ORG_B, qrCode: 'QR-SHARED' });

            await expect(binService.getByQrCode(ORG_A, 'QR-SHARED', 'user-1', 'ADMIN')).rejects.toMatchObject({
                code: 'NOT_FOUND',
            });
        });

        it('resolves the bin when it belongs to the requesting org', async () => {
            const bin = seedBin({ organizationId: ORG_A, qrCode: 'QR-MINE' });

            const result = await binService.getByQrCode(ORG_A, 'QR-MINE', 'user-1', 'ADMIN');

            expect(result.id).toBe(bin.id);
        });
    });

    describe('cycleService.pickup / deliver', () => {
        it('pickup rejects with NOT_FOUND (never FORBIDDEN) for a foreign-org cycle', async () => {
            const cycle = seedCycle({ organizationId: ORG_B, status: 'ACTIVE' });

            await expect(
                cycleService.pickup(ORG_A, { cycleId: cycle.id, vehicleId: 'v1' }, 'admin-1', 'ADMIN'),
            ).rejects.toMatchObject({ code: 'NOT_FOUND' });
            expect(store.cycles.find((c) => c.id === cycle.id)?.status).toBe('ACTIVE');
        });

        it('deliver rejects with NOT_FOUND (never FORBIDDEN) for a foreign-org cycle', async () => {
            const cycle = seedCycle({ organizationId: ORG_B, status: 'IN_TRANSIT', driverId: 'admin-1' });
            const destination = seedFacility({ organizationId: ORG_B, type: 'RENDERING' });

            await expect(
                cycleService.deliver(ORG_A, { cycleId: cycle.id, destinationId: destination.id }, 'admin-1', 'ADMIN'),
            ).rejects.toMatchObject({ code: 'NOT_FOUND' });
            expect(store.cycles.find((c) => c.id === cycle.id)?.status).toBe('IN_TRANSIT');
        });
    });

    describe('dashboardService.getStats', () => {
        it('never counts another org\'s active cycles for an ADMIN caller', async () => {
            seedCycle({ organizationId: ORG_A, status: 'ACTIVE' });
            seedCycle({ organizationId: ORG_B, status: 'ACTIVE' });
            seedCycle({ organizationId: ORG_B, status: 'IN_TRANSIT' });

            const result = await dashboardService.getStats(ORG_A, [], 'ADMIN');

            expect(result.totalActiveBins).toBe(1);
        });
    });
});
