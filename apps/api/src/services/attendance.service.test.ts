import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the queries attendance.service.ts actually uses.
//
// Regression focus: WorkSession/AttendanceEvent have no organizationId
// column of their own (they chain through Employee) — before this batch,
// summary() and recent() had no org filter at all (real cross-tenant
// leaks), and scan()'s employee lookup used a global findFirst on qrCode
// even though qrCode is only unique per-organization.

interface FakeEmployee {
    id: string;
    organizationId: string;
    employeeCode: string;
    fullName: string;
    qrCode: string;
    status: 'ACTIVE' | 'INACTIVE';
}
interface FakeSession {
    id: string;
    employeeId: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    durationMin: number | null;
    autoClosed: boolean;
}
interface FakeEvent {
    id: string;
    employeeId: string;
    sessionId: string | null;
    eventType: 'CHECK_IN' | 'CHECK_OUT' | 'DEBOUNCED' | 'REJECTED' | 'REGISTERED';
    scannedAt: Date;
    source: string | null;
}

const store = vi.hoisted(() => {
    return {
        employees: [] as FakeEmployee[],
        sessions: [] as FakeSession[],
        events: [] as FakeEvent[],
        seq: 0,
        // The org's clock-in method. QR scans only work while it is 'QR'; the suite below runs the QR path.
        method: 'QR' as 'NFC' | 'QR',
    };
});

function nextId(prefix: string): string {
    store.seq += 1;
    return `${prefix}-${store.seq}`;
}

const fakePrisma = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('@bin-tracker/db', () => {
    const employee = {
        findUnique: ({ where }: { where: { organizationId_qrCode: { organizationId: string; qrCode: string } } }) =>
            Promise.resolve(
                store.employees.find(
                    (e) =>
                        e.organizationId === where.organizationId_qrCode.organizationId &&
                        e.qrCode === where.organizationId_qrCode.qrCode,
                ) ?? null,
            ),
        findMany: ({ where }: { where: { organizationId: string } }) =>
            Promise.resolve(
                store.employees
                    .filter((e) => e.organizationId === where.organizationId)
                    .map((e) => ({ ...e, sessions: store.sessions.filter((s) => s.employeeId === e.id) })),
            ),
    };
    const workSession = {
        findFirst: ({ where, orderBy }: { where: { employeeId: string; checkOutAt?: null }; orderBy?: { checkInAt?: 'asc' | 'desc' } }) => {
            let rows = store.sessions.filter((s) => s.employeeId === where.employeeId);
            if (where.checkOutAt === null) rows = rows.filter((s) => s.checkOutAt === null);
            rows = rows.sort((a, b) =>
                orderBy?.checkInAt === 'desc'
                    ? b.checkInAt.getTime() - a.checkInAt.getTime()
                    : a.checkInAt.getTime() - b.checkInAt.getTime(),
            );
            return Promise.resolve(rows[0] ?? null);
        },
        create: ({ data }: { data: { employeeId: string; checkInAt: Date } }) => {
            const session: FakeSession = {
                id: nextId('s'),
                employeeId: data.employeeId,
                checkInAt: data.checkInAt,
                checkOutAt: null,
                durationMin: null,
                autoClosed: false,
            };
            store.sessions.push(session);
            return Promise.resolve(session);
        },
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeSession> }) => {
            const session = store.sessions.find((s) => s.id === where.id);
            if (!session) throw new Error('session not found');
            Object.assign(session, data);
            return Promise.resolve(session);
        },
    };
    const attendanceEvent = {
        findFirst: ({ where, orderBy }: { where: { employeeId: string; eventType?: { in: string[] } }; orderBy?: { scannedAt?: 'asc' | 'desc' } }) => {
            const rows = store.events
                .filter((e) => e.employeeId === where.employeeId)
                .filter((e) => !where.eventType || where.eventType.in.includes(e.eventType))
                .sort((a, b) =>
                    orderBy?.scannedAt === 'desc'
                        ? b.scannedAt.getTime() - a.scannedAt.getTime()
                        : a.scannedAt.getTime() - b.scannedAt.getTime(),
                );
            const event = rows[0];
            if (!event) return Promise.resolve(null);
            const session = store.sessions.find((s) => s.id === event.sessionId);
            return Promise.resolve({ ...event, session });
        },
        findMany: ({ where }: { where: { employee: { organizationId: string }; eventType?: { in: string[] } } }) => {
            const orgEmployeeIds = new Set(
                store.employees.filter((e) => e.organizationId === where.employee.organizationId).map((e) => e.id),
            );
            const rows = store.events
                .filter((e) => orgEmployeeIds.has(e.employeeId))
                .filter((e) => !where.eventType || where.eventType.in.includes(e.eventType))
                .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime())
                .map((e) => ({ ...e, employee: store.employees.find((emp) => emp.id === e.employeeId)! }));
            return Promise.resolve(rows);
        },
        create: ({ data }: { data: Omit<FakeEvent, 'id'> }) => {
            const event: FakeEvent = { id: nextId('e'), ...data };
            store.events.push(event);
            return Promise.resolve(event);
        },
    };

    const settings = {
        findUnique: () => Promise.resolve({ attendanceMethod: store.method }),
    };

    Object.assign(fakePrisma, {
        settings,
        employee,
        workSession,
        attendanceEvent,
        // The per-employee advisory lock is a no-op in-memory (the DB-backed suite proves it).
        $executeRaw: () => Promise.resolve(0),
        $transaction: (cb: (tx: unknown) => unknown) => Promise.resolve(cb(fakePrisma)),
    });

    return { prisma: fakePrisma };
});

// Import AFTER the mock is registered.
const { attendanceService } = await import('./attendance.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function seedEmployee(overrides: Partial<FakeEmployee> = {}): FakeEmployee {
    const employee: FakeEmployee = {
        id: nextId('emp'),
        organizationId: ORG_A,
        employeeCode: 'EMP-TEST',
        fullName: 'Jane Doe',
        qrCode: 'ATT-token-1',
        status: 'ACTIVE',
        ...overrides,
    };
    store.employees.push(employee);
    return employee;
}

beforeEach(() => {
    store.employees.length = 0;
    store.sessions.length = 0;
    store.events.length = 0;
    store.seq = 0;
    store.method = 'QR';
});

describe('attendanceService.scan: method switch', () => {
    it('refuses a QR scan while the organization is on NFC, and records nothing', async () => {
        store.method = 'NFC';
        const emp = seedEmployee();

        await expect(attendanceService.scan(ORG_A, { qrCode: emp.qrCode })).rejects.toMatchObject({
            code: 'PRECONDITION_FAILED',
            appCode: 'QR_DISABLED',
        });
        expect(store.sessions).toHaveLength(0);
        expect(store.events).toHaveLength(0);
    });

    it('works again as soon as the organization is switched back to QR (the rollback)', async () => {
        store.method = 'NFC';
        const emp = seedEmployee();
        await expect(attendanceService.scan(ORG_A, { qrCode: emp.qrCode })).rejects.toMatchObject({ appCode: 'QR_DISABLED' });

        store.method = 'QR';

        await expect(attendanceService.scan(ORG_A, { qrCode: emp.qrCode })).resolves.toMatchObject({ action: 'CHECK_IN' });
    });
});

describe('attendanceService.scan', () => {
    it('opens a session (CHECK_IN) on first scan', async () => {
        const emp = seedEmployee();
        const result = await attendanceService.scan(ORG_A, { qrCode: emp.qrCode });

        expect(result.action).toBe('CHECK_IN');
        expect(result.debounced).toBe(false);
        expect(store.sessions).toHaveLength(1);
        expect(store.sessions[0]?.checkOutAt).toBeNull();
        expect(store.events).toHaveLength(1);
    });

    it('closes the open session (CHECK_OUT) and records duration on the next scan', async () => {
        const emp = seedEmployee();
        // Open a session 2 hours ago so the debounce window does not apply.
        const checkInAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        store.sessions.push({
            id: 's-pre',
            employeeId: emp.id,
            checkInAt,
            checkOutAt: null,
            durationMin: null,
            autoClosed: false,
        });
        store.events.push({
            id: 'e-pre',
            employeeId: emp.id,
            sessionId: 's-pre',
            eventType: 'CHECK_IN',
            scannedAt: checkInAt,
            source: null,
        });

        const result = await attendanceService.scan(ORG_A, { qrCode: emp.qrCode });

        expect(result.action).toBe('CHECK_OUT');
        expect(result.durationMin).toBeGreaterThanOrEqual(119);
        expect(result.durationMin).toBeLessThanOrEqual(121);
        expect(store.sessions[0]?.checkOutAt).not.toBeNull();
    });

    it('debounces an accidental double scan', async () => {
        const emp = seedEmployee();
        await attendanceService.scan(ORG_A, { qrCode: emp.qrCode }); // CHECK_IN
        const second = await attendanceService.scan(ORG_A, { qrCode: emp.qrCode }); // immediate re-scan

        expect(second.debounced).toBe(true);
        expect(second.action).toBe('CHECK_IN');
        // Still exactly one session — no phantom toggle. The echo is audited as a
        // DEBOUNCED row; it is bookkeeping, never a second check-in.
        expect(store.sessions).toHaveLength(1);
        expect(store.events.map((e) => e.eventType)).toEqual(['CHECK_IN', 'DEBOUNCED']);
    });

    it('auto-closes a forgotten 17 h shift at the 16 h cap, holds it for approval, then opens a fresh shift', async () => {
        const emp = seedEmployee();
        store.sessions.push({
            id: 's-old',
            employeeId: emp.id,
            checkInAt: new Date(Date.now() - 17 * 3_600_000),
            checkOutAt: null,
            durationMin: null,
            autoClosed: false,
        });

        const result = await attendanceService.scan(ORG_A, { qrCode: emp.qrCode });

        const old = store.sessions.find((s) => s.id === 's-old')!;
        expect(old).toMatchObject({ autoClosed: true, durationMin: 960 });
        expect(old.checkOutAt?.getTime()).toBe(old.checkInAt.getTime() + 16 * 3_600_000);
        // The scan did NOT pay the stale shift as a 17 h check-out; it started a new one.
        expect(result.action).toBe('CHECK_IN');
        expect(store.sessions.filter((s) => s.checkOutAt === null)).toHaveLength(1);
    });

    it('leaves a 15 h shift alone and checks it out normally', async () => {
        const emp = seedEmployee();
        store.sessions.push({
            id: 's-15h',
            employeeId: emp.id,
            checkInAt: new Date(Date.now() - 15 * 3_600_000),
            checkOutAt: null,
            durationMin: null,
            autoClosed: false,
        });

        const result = await attendanceService.scan(ORG_A, { qrCode: emp.qrCode });

        expect(result.action).toBe('CHECK_OUT');
        expect(store.sessions[0]?.autoClosed).toBe(false);
    });

    it('rejects an unknown QR code', async () => {
        await expect(attendanceService.scan(ORG_A, { qrCode: 'nope' })).rejects.toThrow();
    });

    it('rejects an inactive employee', async () => {
        const emp = seedEmployee({ status: 'INACTIVE', qrCode: 'ATT-inactive' });
        await expect(attendanceService.scan(ORG_A, { qrCode: emp.qrCode })).rejects.toThrow();
    });

    it('rejects a qrCode that belongs to a different org', async () => {
        const emp = seedEmployee({ organizationId: ORG_B, qrCode: 'ATT-other-org' });
        await expect(attendanceService.scan(ORG_A, { qrCode: emp.qrCode })).rejects.toThrow();
    });
});

describe('attendanceService.summary', () => {
    it('only includes employees belonging to the requesting org', async () => {
        seedEmployee({ id: 'emp-a', organizationId: ORG_A, qrCode: 'ATT-a' });
        seedEmployee({ id: 'emp-b', organizationId: ORG_B, qrCode: 'ATT-b' });

        const result = await attendanceService.summary(ORG_A, {});

        expect(result.map((r) => r.employeeId)).toEqual(['emp-a']);
    });
});

describe('attendanceService.recent', () => {
    it('only includes events for employees in the requesting org', async () => {
        const empA = seedEmployee({ id: 'emp-a', organizationId: ORG_A, qrCode: 'ATT-a' });
        const empB = seedEmployee({ id: 'emp-b', organizationId: ORG_B, qrCode: 'ATT-b' });
        store.events.push(
            { id: 'ev-a', employeeId: empA.id, sessionId: 's-a', eventType: 'CHECK_IN', scannedAt: new Date(), source: null },
            { id: 'ev-b', employeeId: empB.id, sessionId: 's-b', eventType: 'CHECK_IN', scannedAt: new Date(), source: null },
        );

        const result = await attendanceService.recent(ORG_A, { limit: 10 });

        expect(result.map((r) => r.id)).toEqual(['ev-a']);
    });

    it('lists check-ins and check-outs only, not NFC bookkeeping rows', async () => {
        const emp = seedEmployee({ id: 'emp-a', organizationId: ORG_A, qrCode: 'ATT-a' });
        const at = new Date();
        store.events.push(
            { id: 'ev-in', employeeId: emp.id, sessionId: 's-1', eventType: 'CHECK_IN', scannedAt: at, source: 'nfc' },
            { id: 'ev-deb', employeeId: emp.id, sessionId: 's-1', eventType: 'DEBOUNCED', scannedAt: at, source: 'nfc' },
            { id: 'ev-rej', employeeId: emp.id, sessionId: null, eventType: 'REJECTED', scannedAt: at, source: 'nfc' },
            { id: 'ev-reg', employeeId: emp.id, sessionId: null, eventType: 'REGISTERED', scannedAt: at, source: 'nfc' },
        );

        const result = await attendanceService.recent(ORG_A, { limit: 10 });

        expect(result.map((r) => r.id)).toEqual(['ev-in']);
    });
});
