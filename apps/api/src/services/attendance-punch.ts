import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
type EventType = 'CHECK_IN' | 'CHECK_OUT' | 'DEBOUNCED' | 'REJECTED' | 'REGISTERED';

/** Repeated taps within this window are treated as an accidental double-tap. */
export const DEBOUNCE_MS = 5_000;
/** An open shift this old is a forgotten check-out: closed at the cap, held for approval. */
export const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;
export const MAX_SHIFT_MINUTES = MAX_SHIFT_MS / 60_000;
/** AttendanceEvent.source of the CHECK_OUT written when a forgotten shift is closed at the cap. */
export const AUTO_CLOSE_SOURCE = 'auto-close';

/** What a card/scan asks for. BOTH toggles; IN and OUT are strict. */
export type PunchDirection = 'IN' | 'OUT' | 'BOTH';

/**
 * Mismatches (ALREADY_CHECKED_IN / NOT_CHECKED_IN) are RETURNED, not thrown: a
 * thrown error rolls the transaction back and would lose the REJECTED audit row.
 */
export type PunchResult =
    | { status: 'CHECK_IN'; sessionId: string; at: Date; debounced: boolean }
    | { status: 'CHECK_OUT'; sessionId: string; at: Date; since: Date; durationMin: number; debounced: boolean }
    | { status: 'ALREADY_CHECKED_IN'; at: Date; since: Date; debounced: boolean }
    | { status: 'NOT_CHECKED_IN'; at: Date; debounced: boolean }
    | { status: 'REGISTRATION_COMPLETE'; at: Date; debounced: boolean };

export interface PunchOptions {
    employeeId: string;
    direction: PunchDirection;
    now: Date;
    /** Written to AttendanceEvent.source ('nfc' for taps, the guard post label for QR scans). */
    source: string | null;
    /**
     * Which earlier events a new punch may echo as a double-tap. QR scans only
     * know check-ins and check-outs; a tap also echoes rejections and registration.
     */
    debounceOn: readonly EventType[];
}

type OpenSession = { id: string; checkInAt: Date };

/**
 * If the open shift is MAX_SHIFT_MS old or more, close it at the cap and flag it
 * autoClosed with no approvedAt. Payroll then reports it as an AUTO_CLOSED
 * exception and does not pay it until a manager approves. Lazy by design: there
 * is no background job, so every path that asks "is there an open shift?" runs
 * this first. Returns true when it closed one.
 */
export async function closeIfStale(tx: Tx, employeeId: string, open: OpenSession | null, now: Date): Promise<boolean> {
    if (!open || now.getTime() - open.checkInAt.getTime() < MAX_SHIFT_MS) return false;
    const closeAt = new Date(open.checkInAt.getTime() + MAX_SHIFT_MS);
    await tx.workSession.update({
        where: { id: open.id },
        data: {
            checkOutAt: closeAt,
            durationMin: MAX_SHIFT_MINUTES,
            autoClosed: true,
            approvedAt: null,
        },
    });
    // Leave the same audit trail a real check-out leaves, so the event log and the recent-scans feed never
    // show a CHECK_IN with no matching CHECK_OUT. Its source tells it apart from a person's tap.
    await tx.attendanceEvent.create({
        data: { employeeId, sessionId: open.id, eventType: 'CHECK_OUT', scannedAt: closeAt, source: AUTO_CLOSE_SOURCE },
    });
    return true;
}

/**
 * The one place a punch is decided. MUST run inside `withLock('employee:<id>')`
 * (lib/with-lock.ts): the per-employee lock plus the partial unique index on
 * open sessions are what make two racing taps unable to open two shifts.
 *
 * Order: lazy auto-close of a stale shift, then debounce, then the direction rule.
 */
export async function punchInTx(tx: Tx, opts: PunchOptions): Promise<PunchResult> {
    const { employeeId, direction, now, source, debounceOn } = opts;

    let open: OpenSession | null = await tx.workSession.findFirst({
        where: { employeeId, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
        select: { id: true, checkInAt: true },
    });
    if (await closeIfStale(tx, employeeId, open, now)) open = null;

    const rejection = (debounced: boolean): PunchResult =>
        open
            ? { status: 'ALREADY_CHECKED_IN', at: now, since: open.checkInAt, debounced }
            : { status: 'NOT_CHECKED_IN', at: now, debounced };

    // Debounce is anchored on the last REAL punch: an echo (DEBOUNCED row) never
    // extends the window, so a held-down phone cannot keep itself locked out.
    // The system's own auto-close CHECK_OUT is not a punch: it is stamped at the 16 h mark, which can be only
    // seconds before this tap, and echoing it would turn a fresh check-in into a phantom check-out.
    const last = await tx.attendanceEvent.findFirst({
        where: { employeeId, eventType: { in: [...debounceOn] }, OR: [{ source: null }, { source: { not: AUTO_CLOSE_SOURCE } }] },
        orderBy: { scannedAt: 'desc' },
        include: { session: true },
    });
    if (last && now.getTime() - last.scannedAt.getTime() < DEBOUNCE_MS) {
        await tx.attendanceEvent.create({
            data: { employeeId, sessionId: last.sessionId, eventType: 'DEBOUNCED', scannedAt: now, source },
        });
        return echoOf(last, rejection);
    }

    // BOTH checks in when there is no open shift and out when there is one, so it
    // can never be a "wrong card". IN and OUT stay strict.
    const checksIn = direction === 'IN' || (direction === 'BOTH' && !open);
    const checksOut = direction === 'OUT' || (direction === 'BOTH' && !!open);

    if (checksIn && !open) {
        const session = await tx.workSession.create({ data: { employeeId, checkInAt: now } });
        await tx.attendanceEvent.create({
            data: { employeeId, sessionId: session.id, eventType: 'CHECK_IN', scannedAt: now, source },
        });
        return { status: 'CHECK_IN', sessionId: session.id, at: now, debounced: false };
    }

    if (checksOut && open) {
        const durationMin = Math.max(0, Math.round((now.getTime() - open.checkInAt.getTime()) / 60_000));
        await tx.workSession.update({ where: { id: open.id }, data: { checkOutAt: now, durationMin } });
        await tx.attendanceEvent.create({
            data: { employeeId, sessionId: open.id, eventType: 'CHECK_OUT', scannedAt: now, source },
        });
        return { status: 'CHECK_OUT', sessionId: open.id, at: now, since: open.checkInAt, durationMin, debounced: false };
    }

    await tx.attendanceEvent.create({
        data: { employeeId, sessionId: open?.id ?? null, eventType: 'REJECTED', scannedAt: now, source },
    });
    return rejection(false);
}

/** Rebuilds the result of the previous real punch, returned for a double-tap. */
function echoOf(
    last: {
        eventType: string;
        scannedAt: Date;
        sessionId: string | null;
        session: { checkInAt: Date; checkOutAt: Date | null; durationMin: number | null } | null;
    },
    rejection: (debounced: boolean) => PunchResult,
): PunchResult {
    const { session } = last;
    switch (last.eventType) {
        case 'CHECK_IN':
            return { status: 'CHECK_IN', sessionId: last.sessionId ?? '', at: session?.checkInAt ?? last.scannedAt, debounced: true };
        case 'CHECK_OUT':
            return {
                status: 'CHECK_OUT',
                sessionId: last.sessionId ?? '',
                at: session?.checkOutAt ?? last.scannedAt,
                since: session?.checkInAt ?? last.scannedAt,
                durationMin: session?.durationMin ?? 0,
                debounced: true,
            };
        case 'REGISTERED':
            return { status: 'REGISTRATION_COMPLETE', at: last.scannedAt, debounced: true };
        default:
            // REJECTED: nothing changed since, so the same rejection still applies.
            return rejection(true);
    }
}
