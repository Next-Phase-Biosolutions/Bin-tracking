import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── payrollService.computeRun ──────────────────────────────────────────────
// Fake covers exactly what computeRun touches: settings/payrollRun lookups, a
// callback-style $transaction (tx === prisma, matching resolve.test's "fake
// covers only what's touched" philosophy), two $queryRaw calls per run (clean
// sessions, then dirty sessions) fed from a queue so each test controls the
// exact rows computeRun sees, and payrollLineItem/payrollException create.
//
// ponytail: this suite verifies the JS aggregation/rate-resolution/rounding/
// classification logic by feeding canned $queryRaw rows — it does NOT exercise
// the actual DST-aware SQL bucketing (the WHERE/GROUP BY text itself), since
// this repo has no real-Postgres integration test harness. If the raw SQL
// itself needs regression coverage, add a testcontainers-backed suite then.

interface FakeSettings {
    organizationId: string;
    flatHourlyRateCents: number;
    companyTimezone: string;
    currency: string;
}
interface FakeRun {
    id: string;
    organizationId: string;
    period: string;
    status: string;
    rateCents: number;
    currency: string;
    totalEmployees: number;
    totalMinutes: number;
    totalGrossCents: number;
    computedAt: Date | null;
    createdAt: Date;
}
interface FakeLineItem {
    id: string;
    runId: string;
    employeeId: string;
    minutes: number;
    hours: number;
    rateCents: number;
    grossCents: number;
    payoutStatus: string;
    payoutRef: string | null;
    paidAt: Date | null;
}
interface FakeException {
    id: string;
    runId: string;
    employeeId: string;
    sessionId: string;
    type: string;
    resolved: boolean;
    note: string | null;
}
interface FakeEmployee {
    employeeCode: string;
    fullName: string;
}
interface FakeSession {
    checkInAt: Date;
}
interface CleanRow {
    employeeId: string;
    minutes: number;
    hourlyRateCents: number | null;
}
interface ExceptionRow {
    id: string;
    employeeId: string;
    checkOutAt: Date | null;
}

const store = vi.hoisted(() => ({
    settings: [] as FakeSettings[],
    runs: [] as FakeRun[],
    lineItems: [] as FakeLineItem[],
    exceptions: [] as FakeException[],
    employees: new Map<string, FakeEmployee>(),
    sessions: new Map<string, FakeSession>(),
    // Each computeRun call does two $queryRaw calls in order: [cleanRows, exceptionRows].
    queryRawQueue: [] as unknown[][],
    idCounter: 0,
}));

function nextId(prefix: string): string {
    store.idCounter += 1;
    return `${prefix}-${store.idCounter}`;
}

vi.mock('@bin-tracker/db', () => {
    const settings = {
        findUnique: ({ where }: { where: { organizationId: string } }) =>
            Promise.resolve(store.settings.find((s) => s.organizationId === where.organizationId) ?? null),
    };

    function findRun(orgId: string, period: string): FakeRun | undefined {
        return store.runs.find((r) => r.organizationId === orgId && r.period === period);
    }

    function toEmployeeRef(employeeId: string): FakeEmployee {
        return store.employees.get(employeeId) ?? { employeeCode: employeeId, fullName: employeeId };
    }

    const payrollRun = {
        findUnique: ({
            where,
        }: {
            where: { organizationId_period: { organizationId: string; period: string } };
        }) => {
            const run = findRun(where.organizationId_period.organizationId, where.organizationId_period.period);
            if (!run) return Promise.resolve(null);
            return Promise.resolve({
                ...run,
                lineItems: store.lineItems
                    .filter((li) => li.runId === run.id)
                    .map((li) => ({ ...li, employee: toEmployeeRef(li.employeeId) })),
                exceptions: store.exceptions
                    .filter((ex) => ex.runId === run.id)
                    .map((ex) => ({
                        ...ex,
                        employee: toEmployeeRef(ex.employeeId),
                        session: store.sessions.get(ex.sessionId) ?? { checkInAt: new Date(0) },
                    })),
            });
        },
        upsert: ({
            where,
            create,
        }: {
            where: { organizationId_period: { organizationId: string; period: string } };
            create: { period: string; rateCents: number; currency: string; organizationId: string };
        }) => {
            const existing = findRun(where.organizationId_period.organizationId, where.organizationId_period.period);
            if (existing) return Promise.resolve(existing);
            const run: FakeRun = {
                id: nextId('run'),
                organizationId: create.organizationId,
                period: create.period,
                status: 'DRAFT',
                rateCents: create.rateCents,
                currency: create.currency,
                totalEmployees: 0,
                totalMinutes: 0,
                totalGrossCents: 0,
                computedAt: null,
                createdAt: new Date(),
            };
            store.runs.push(run);
            return Promise.resolve(run);
        },
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeRun> }) => {
            const run = store.runs.find((r) => r.id === where.id)!;
            Object.assign(run, data);
            return Promise.resolve(run);
        },
    };

    const payrollLineItem = {
        deleteMany: ({ where }: { where: { runId: string } }) => {
            store.lineItems = store.lineItems.filter((li) => li.runId !== where.runId);
            return Promise.resolve({ count: 0 });
        },
        create: ({ data }: { data: Omit<FakeLineItem, 'id' | 'payoutStatus' | 'payoutRef' | 'paidAt'> }) => {
            const item: FakeLineItem = { ...data, id: nextId('li'), payoutStatus: 'PENDING', payoutRef: null, paidAt: null };
            store.lineItems.push(item);
            return Promise.resolve(item);
        },
    };

    const payrollException = {
        findMany: ({ where }: { where: { runId: string; resolved: boolean } }) =>
            Promise.resolve(
                store.exceptions
                    .filter((ex) => ex.runId === where.runId && ex.resolved === where.resolved)
                    .map((ex) => ({ sessionId: ex.sessionId })),
            ),
        deleteMany: ({ where }: { where: { runId: string; resolved: boolean } }) => {
            store.exceptions = store.exceptions.filter((ex) => !(ex.runId === where.runId && ex.resolved === where.resolved));
            return Promise.resolve({ count: 0 });
        },
        create: ({ data }: { data: { runId: string; employeeId: string; sessionId: string; type: string } }) => {
            const exception: FakeException = { ...data, id: nextId('ex'), resolved: false, note: null };
            store.exceptions.push(exception);
            return Promise.resolve(exception);
        },
    };

    // Named type (not `typeof prisma` inline) — self-referencing the object
    // literal's own inferred type inside itself is a TS circular-reference
    // error ("'prisma' is referenced directly or indirectly in its own type
    // annotation"). A named type alias can be self-referential; a `const`'s
    // inferred type cannot be used inside its own initializer.
    type FakePrisma = {
        settings: typeof settings;
        payrollRun: typeof payrollRun;
        payrollLineItem: typeof payrollLineItem;
        payrollException: typeof payrollException;
        $queryRaw: () => Promise<unknown[]>;
        $transaction: (cb: (tx: FakePrisma) => Promise<void>) => Promise<void>;
    };

    const prisma: FakePrisma = {
        settings,
        payrollRun,
        payrollLineItem,
        payrollException,
        $queryRaw: () => Promise.resolve(store.queryRawQueue.shift() ?? []),
        $transaction: (cb) => cb(prisma),
    };
    return { prisma };
});

const { payrollService } = await import('./payroll.service.js');

const ORG_A = 'org-a';

function seedSettings(overrides: Partial<FakeSettings> = {}): void {
    store.settings.push({
        organizationId: ORG_A,
        flatHourlyRateCents: 2500,
        companyTimezone: 'America/Toronto',
        currency: 'CAD',
        ...overrides,
    });
}

function queueRows(cleanRows: CleanRow[], exceptionRows: ExceptionRow[] = []): void {
    store.queryRawQueue.push(cleanRows, exceptionRows);
}

beforeEach(() => {
    store.settings.length = 0;
    store.runs.length = 0;
    store.lineItems.length = 0;
    store.exceptions.length = 0;
    store.employees.clear();
    store.sessions.clear();
    store.queryRawQueue.length = 0;
    store.idCounter = 0;
});

describe('payrollService.computeRun', () => {
    it('pays clean sessions at the org flat rate when no employee override exists', async () => {
        seedSettings({ flatHourlyRateCents: 2500 }); // $25/hr
        queueRows([{ employeeId: 'emp-1', minutes: 120, hourlyRateCents: null }]); // 2h

        const result = await payrollService.computeRun(ORG_A, { period: '2026-07' });

        expect(result.totalEmployees).toBe(1);
        expect(result.totalMinutes).toBe(120);
        expect(result.totalGrossCents).toBe(5000); // 2h * 2500
        expect(result.lineItems[0]).toMatchObject({ employeeId: 'emp-1', rateCents: 2500, grossCents: 5000 });
    });

    it('a per-employee hourly rate override wins over the org flat rate and is snapshotted onto the line item', async () => {
        seedSettings({ flatHourlyRateCents: 2000 });
        queueRows([{ employeeId: 'emp-1', minutes: 90, hourlyRateCents: 3000 }]); // 1.5h @ $30/hr

        const result = await payrollService.computeRun(ORG_A, { period: '2026-07' });

        expect(result.lineItems[0]).toMatchObject({ rateCents: 3000, grossCents: 4500 });
    });

    it('rounds fractional gross pay to the nearest cent', async () => {
        seedSettings({ flatHourlyRateCents: 1750 }); // $17.50/hr
        queueRows([{ employeeId: 'emp-1', minutes: 47, hourlyRateCents: null }]); // 47/60h * 1750 = 1370.8333...

        const result = await payrollService.computeRun(ORG_A, { period: '2026-07' });

        expect(result.lineItems[0]!.grossCents).toBe(1371);
    });

    it('classifies dirty sessions as NO_CHECKOUT or AUTO_CLOSED exceptions, excluded from pay', async () => {
        seedSettings();
        store.employees.set('emp-2', { employeeCode: 'E2', fullName: 'No Checkout' });
        store.employees.set('emp-3', { employeeCode: 'E3', fullName: 'Auto Closed' });
        store.sessions.set('sess-a', { checkInAt: new Date('2026-07-10T14:00:00Z') });
        store.sessions.set('sess-b', { checkInAt: new Date('2026-07-11T14:00:00Z') });
        queueRows(
            [],
            [
                { id: 'sess-a', employeeId: 'emp-2', checkOutAt: null },
                { id: 'sess-b', employeeId: 'emp-3', checkOutAt: new Date('2026-07-11T22:00:00Z') },
            ],
        );

        const result = await payrollService.computeRun(ORG_A, { period: '2026-07' });

        expect(result.totalEmployees).toBe(0);
        expect(result.totalGrossCents).toBe(0);
        const byId = new Map(result.exceptions.map((e) => [e.employeeId, e]));
        expect(byId.get('emp-2')).toMatchObject({ type: 'NO_CHECKOUT' });
        expect(byId.get('emp-3')).toMatchObject({ type: 'AUTO_CLOSED' });
    });

    it('recompute does not resurrect a session whose exception was already resolved', async () => {
        seedSettings();
        store.employees.set('emp-2', { employeeCode: 'E2', fullName: 'No Checkout' });
        store.sessions.set('sess-a', { checkInAt: new Date('2026-07-10T14:00:00Z') });
        // Seed a run with one already-resolved (dismissed) exception for sess-a.
        store.runs.push({
            id: 'run-1',
            organizationId: ORG_A,
            period: '2026-07',
            status: 'DRAFT',
            rateCents: 2500,
            currency: 'CAD',
            totalEmployees: 0,
            totalMinutes: 0,
            totalGrossCents: 0,
            computedAt: new Date(),
            createdAt: new Date(),
        });
        store.exceptions.push({
            id: 'ex-1',
            runId: 'run-1',
            employeeId: 'emp-2',
            sessionId: 'sess-a',
            type: 'NO_CHECKOUT',
            resolved: true,
            note: 'dismissed',
        });
        queueRows([], [{ id: 'sess-a', employeeId: 'emp-2', checkOutAt: null }]);

        const result = await payrollService.computeRun(ORG_A, { period: '2026-07' });

        // The resolved exception survives untouched; no new unresolved one is created.
        expect(result.exceptions).toHaveLength(1);
        expect(result.exceptions[0]).toMatchObject({ resolved: true, note: 'dismissed' });
    });

    it('throws PRECONDITION_FAILED when payroll settings are not configured', async () => {
        await expect(payrollService.computeRun(ORG_A, { period: '2026-07' })).rejects.toMatchObject({
            code: 'PRECONDITION_FAILED',
        });
    });

    it('refuses to recompute a run that has left DRAFT', async () => {
        seedSettings();
        store.runs.push({
            id: 'run-1',
            organizationId: ORG_A,
            period: '2026-07',
            status: 'APPROVED',
            rateCents: 2500,
            currency: 'CAD',
            totalEmployees: 1,
            totalMinutes: 60,
            totalGrossCents: 2500,
            computedAt: new Date(),
            createdAt: new Date(),
        });

        await expect(payrollService.computeRun(ORG_A, { period: '2026-07' })).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });
});
