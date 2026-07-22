import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── payrollService.resolveException ───────────────────────────────────────
// Fake covers exactly what resolveException touches: payrollException
// findUnique/update (with run + session included) and workSession update.
// Money-path invariants under test: org isolation, DRAFT-only, checkout
// bounds, and that FIX_CHECKOUT repairs the session instead of paying directly.

interface FakeRun {
    id: string;
    organizationId: string;
    period: string;
    status: string;
}
interface FakeSession {
    id: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    durationMin: number | null;
    autoClosed: boolean;
}
interface FakeException {
    id: string;
    runId: string;
    sessionId: string;
    resolved: boolean;
    resolvedAt: Date | null;
    note: string | null;
}

const store = vi.hoisted(() => ({
    runs: [] as FakeRun[],
    sessions: [] as FakeSession[],
    exceptions: [] as FakeException[],
}));

vi.mock('@bin-tracker/db', () => {
    const payrollException = {
        findUnique: ({ where }: { where: { id: string } }) => {
            const ex = store.exceptions.find((e) => e.id === where.id);
            if (!ex) return Promise.resolve(null);
            return Promise.resolve({
                ...ex,
                run: store.runs.find((r) => r.id === ex.runId)!,
                session: store.sessions.find((s) => s.id === ex.sessionId)!,
            });
        },
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeException> }) => {
            const ex = store.exceptions.find((e) => e.id === where.id)!;
            Object.assign(ex, data);
            return Promise.resolve({ ...ex });
        },
    };
    const workSession = {
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeSession> }) => {
            const s = store.sessions.find((x) => x.id === where.id)!;
            Object.assign(s, data);
            return Promise.resolve({ ...s });
        },
    };
    const prisma = {
        payrollException,
        workSession,
        $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    };
    return { prisma };
});

const { payrollService } = await import('./payroll.service.js');

const ORG_A = 'org-a';
const CHECK_IN = new Date('2026-07-10T14:00:00Z');

function seed(runStatus = 'DRAFT'): void {
    store.runs.push({ id: 'run-1', organizationId: ORG_A, period: '2026-07', status: runStatus });
    store.sessions.push({ id: 'sess-1', checkInAt: CHECK_IN, checkOutAt: null, durationMin: null, autoClosed: false });
    store.exceptions.push({ id: 'ex-1', runId: 'run-1', sessionId: 'sess-1', resolved: false, resolvedAt: null, note: null });
}

beforeEach(() => {
    store.runs.length = 0;
    store.sessions.length = 0;
    store.exceptions.length = 0;
});

describe('payrollService.resolveException', () => {
    it('DISMISS marks resolved with the note and requires no recompute', async () => {
        seed();

        const result = await payrollService.resolveException(ORG_A, {
            exceptionId: 'ex-1',
            action: 'DISMISS',
            note: 'left early, unpaid by agreement',
        });

        expect(result).toEqual({ resolved: true, requiresRecompute: false });
        expect(store.exceptions[0]).toMatchObject({ resolved: true, note: 'left early, unpaid by agreement' });
        // The dirty session is untouched — hours stay unpaid.
        expect(store.sessions[0]?.checkOutAt).toBeNull();
    });

    it('FIX_CHECKOUT repairs the session (checkout, duration, autoClosed) and asks for a recompute', async () => {
        seed();

        const result = await payrollService.resolveException(ORG_A, {
            exceptionId: 'ex-1',
            action: 'FIX_CHECKOUT',
            checkOutAt: '2026-07-10T22:00:00.000Z', // 8h after check-in
        });

        expect(result).toEqual({ resolved: true, requiresRecompute: true });
        expect(store.sessions[0]).toMatchObject({ durationMin: 480, autoClosed: false });
        expect(store.sessions[0]?.checkOutAt?.toISOString()).toBe('2026-07-10T22:00:00.000Z');
        expect(store.exceptions[0]?.resolved).toBe(true);
    });

    it('rejects a checkout before check-in and one implying a >16h shift', async () => {
        seed();

        await expect(
            payrollService.resolveException(ORG_A, {
                exceptionId: 'ex-1',
                action: 'FIX_CHECKOUT',
                checkOutAt: '2026-07-10T13:00:00.000Z', // before check-in
            }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

        await expect(
            payrollService.resolveException(ORG_A, {
                exceptionId: 'ex-1',
                action: 'FIX_CHECKOUT',
                checkOutAt: '2026-07-11T14:00:00.000Z', // 24h shift
            }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('cross-org resolution fails NOT_FOUND (indistinguishable from missing)', async () => {
        seed();

        await expect(
            payrollService.resolveException('org-b', { exceptionId: 'ex-1', action: 'DISMISS' }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('refuses on a non-DRAFT run and on an already-resolved exception', async () => {
        seed('APPROVED');
        await expect(
            payrollService.resolveException(ORG_A, { exceptionId: 'ex-1', action: 'DISMISS' }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });

        store.runs[0]!.status = 'DRAFT';
        store.exceptions[0]!.resolved = true;
        await expect(
            payrollService.resolveException(ORG_A, { exceptionId: 'ex-1', action: 'DISMISS' }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
});
