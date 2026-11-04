import { prisma } from '@bin-tracker/db';
import { AppError } from '../lib/app-error.js';
import { hashToken } from '../lib/token.js';
import { withLock } from '../lib/with-lock.js';
import { punchInTx, type PunchResult } from './attendance-punch.js';
import { deviceRegistrationService } from './device-registration.service.js';

/** Refresh `lastUsedAt` at most this often, so most taps skip the write entirely. */
const LAST_USED_REFRESH_MS = 5 * 60_000;

export type TapResult = PunchResult & { employeeName: string };

export interface TapRequest {
    cardId: string;
    /** Raw device cookie value, if the phone is registered. */
    deviceToken?: string;
    /** Pending-registration cookie value (a SHA-256 hex digest), if mid-registration. */
    pendingHash?: string;
    userAgent?: string;
}

export interface TapOutcome {
    result: TapResult;
    /** Set when this tap completed a registration: the router stores it as the device cookie. */
    newDeviceToken?: string;
}

async function resolveCard(cardId: string) {
    // [TOKEN] The card id in the tag URL is the credential for "which door"; the
    // organization is read from the row, never asserted by the caller.
    const card = await prisma.nfcCard.findUnique({ where: { id: cardId } });
    if (!card) throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');
    if (!card.active) throw new AppError('CARD_INACTIVE', 'FORBIDDEN');
    return card;
}

async function assertWorkforceEnabled(orgId: string) {
    const row = await prisma.organizationModule.findUnique({ where: { orgId_module: { orgId, module: 'WORKFORCE' } } });
    // No row = never provisioned: deny, never default to enabled (same rule as requireModule).
    if (!row?.enabled) throw new AppError('MODULE_DISABLED', 'FORBIDDEN');
}

/**
 * Resolves the tapping employee from the device cookie, and only for the card's
 * organization. A phone registered at org A tapping org B's card gets the same
 * "card not found" as a missing card: nothing reveals that either exists.
 */
async function resolveEmployee(deviceToken: string | undefined, orgId: string, now: Date) {
    if (!deviceToken) throw new AppError('NO_SESSION', 'UNAUTHORIZED');
    const session = await prisma.deviceSession.findUnique({
        where: { sessionTokenHash: hashToken(deviceToken) },
        include: { employee: { select: { id: true, fullName: true, status: true, organizationId: true } } },
    });
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'UNAUTHORIZED');
    if (session.revokedAt) throw new AppError('SESSION_REVOKED', 'FORBIDDEN');
    if (session.organizationId !== orgId || session.employee.organizationId !== orgId) {
        throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');
    }
    if (session.employee.status !== 'ACTIVE') throw new AppError('EMPLOYEE_INACTIVE', 'FORBIDDEN');

    if (!session.lastUsedAt || now.getTime() - session.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
        // Best-effort bookkeeping, off the critical path.
        void prisma.deviceSession.updateMany({ where: { id: session.id, organizationId: orgId }, data: { lastUsedAt: now } }).catch(() => undefined);
    }
    return session.employee;
}

/**
 * One physical tap. The only inputs are the card id from the tag URL and the
 * phone's cookies; the organization comes from the card and is then required to
 * match the device's and the employee's. Nothing the client sends can choose it.
 *
 * A tap is NOT proof of physical presence — the card id is just a string in a
 * URL. See docs/nfc-attendance.
 */
export async function tap(req: TapRequest, now: Date = new Date()): Promise<TapOutcome> {
    // Without any cookie there is nothing to authenticate: refuse before touching
    // the database, so an anonymous caller cannot probe card ids.
    if (!req.deviceToken && !req.pendingHash) throw new AppError('NO_SESSION', 'UNAUTHORIZED');

    const card = await resolveCard(req.cardId);
    await assertWorkforceEnabled(card.organizationId);

    if (req.pendingHash) {
        const reg = await deviceRegistrationService.complete(req.pendingHash, card, req.userAgent, now);
        return {
            result: { status: 'REGISTRATION_COMPLETE', at: reg.at, debounced: false, employeeName: reg.employeeName },
            newDeviceToken: reg.sessionToken,
        };
    }

    const employee = await resolveEmployee(req.deviceToken, card.organizationId, now);
    const result = await withLock(
        `employee:${employee.id}`,
        (tx) =>
            punchInTx(tx, {
                employeeId: employee.id,
                direction: card.direction,
                now,
                source: 'nfc',
                debounceOn: ['CHECK_IN', 'CHECK_OUT', 'REJECTED', 'REGISTERED'],
            }),
        { retryOn: ['P2002'] },
    );
    return { result: { ...result, employeeName: employee.fullName } };
}
