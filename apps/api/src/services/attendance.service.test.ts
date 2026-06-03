import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the queries attendance.service.ts actually uses.

interface FakeEmployee {
    id: string;
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
    sessionId: string;
    eventType: 'CHECK_IN' | 'CHECK_OUT';
    scannedAt: Date;
    source: string | null;
}

const store = vi.hoisted(() => {
    return {
        employees: [] as FakeEmployee[],
        sessions: [] as FakeSession[],
        events: [] as FakeEvent[],
        seq: 0,
    };
});

function nextId(prefix: string): string {
    store.seq += 1;
    return `${prefix}-${store.seq}`;
}

const fakePrisma = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('@bin-tracker/db', () => {
    const employee = {
        findUnique: ({ where }: { where: { qrCode?: string } }) =>
            Promise.resolve(store.employees.find((e) => e.qrCode === where.qrCode) ?? null),
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
        findFirst: ({ where, orderBy }: { where: { employeeId: string }; orderBy?: { scannedAt?: 'asc' | 'desc' } }) => {
            const rows = store.events
                .filter((e) => e.employeeId === where.employeeId)
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
        create: ({ data }: { data: Omit<FakeEvent, 'id'> }) => {
            const event: FakeEvent = { id: nextId('e'), ...data };
            store.events.push(event);
            return Promise.resolve(event);
        },
    };

    Object.assign(fakePrisma, {
        employee,
        workSession,
        attendanceEvent,
        $transaction: (cb: (tx: unknown) => unknown) => Promise.resolve(cb(fakePrisma)),
    });

    return { prisma: fakePrisma };
});

// Import AFTER the mock is registered.
const { attendanceService } = await import('./attendance.service.js');

function seedEmployee(overrides: Partial<FakeEmployee> = {}): FakeEmployee {
    const employee: FakeEmployee = {
        id: nextId('emp'),
        employeeCode: 'EMP-TEST',
        fullName: 'Jane Doe',
        qrCode: 'ATT-token-1',
        status: 'ACTIVE',
        ...overrides,
    };
    store.employees.push(employee);
    return employee;
}

describe('attendanceService.scan', () => {
    beforeEach(() => {
        store.employees.length = 0;
        store.sessions.length = 0;
        store.events.length = 0;
        store.seq = 0;
    });

    it('opens a session (CHECK_IN) on first scan', async () => {
        const emp = seedEmployee();
        const result = await attendanceService.scan({ qrCode: emp.qrCode });

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

        const result = await attendanceService.scan({ qrCode: emp.qrCode });

        expect(result.action).toBe('CHECK_OUT');
        expect(result.durationMin).toBeGreaterThanOrEqual(119);
        expect(result.durationMin).toBeLessThanOrEqual(121);
        expect(store.sessions[0]?.checkOutAt).not.toBeNull();
    });

    it('debounces an accidental double scan', async () => {
        const emp = seedEmployee();
        await attendanceService.scan({ qrCode: emp.qrCode }); // CHECK_IN
        const second = await attendanceService.scan({ qrCode: emp.qrCode }); // immediate re-scan

        expect(second.debounced).toBe(true);
        expect(second.action).toBe('CHECK_IN');
        // Still exactly one session and one event — no phantom toggle.
        expect(store.sessions).toHaveLength(1);
        expect(store.events).toHaveLength(1);
    });

    it('rejects an unknown QR code', async () => {
        await expect(attendanceService.scan({ qrCode: 'nope' })).rejects.toThrow();
    });

    it('rejects an inactive employee', async () => {
        const emp = seedEmployee({ status: 'INACTIVE', qrCode: 'ATT-inactive' });
        await expect(attendanceService.scan({ qrCode: emp.qrCode })).rejects.toThrow();
    });
});
