import { prisma } from '@bin-tracker/db';
import { AppError } from '../lib/app-error.js';
import { hashToken } from '../lib/token.js';
import { withLock } from '../lib/with-lock.js';
import { consumeTapBudget } from '../trpc/rate-limit.js';
import { punchInTx, type PunchResult } from './attendance-punch.js';
import { deviceRegistrationService } from './device-registration.service.js';

/** Refresh `lastUsedAt` at most this often, so most taps skip the write entirely. */
const LAST_USED_REFRESH_MS = 5 * 60_000;

export type TapResult = PunchResult & { employeeName: string };

export interface TapRequest {
    cardId: string;
    /** Raw device cookie value, if the phone is registered. */
    deviceToken?: string;
    /** Pending-registration cookie secret, if the browser is mid-registration. */
    pendingSecret?: string;
    userAgent?: string;
}

export interface TapOutcome {
    result: TapResult;
    /** Set when this tap completed a registration: the router stores it as the device cookie. */
    newDeviceToken?: string;
}

/**
 * Finds the card IN THE CALLER'S OWN ORGANIZATION and checks it is usable.
 *
 * The organization comes from the caller's proven identity (their device session or
 * pending registration), and the card is looked up scoped to it. A card that does not
 * exist and a card that belongs to another organization are therefore the same
 * answer, CARD_NOT_FOUND, and a card's active/module state is only ever revealed to
 * someone who belongs to its organization.
 */
async function resolveCard(orgId: string, cardId: string) {
    const card = await prisma.nfcCard.findFirst({ where: { id: cardId, organizationId: orgId } });
    if (!card) throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');
    if (!card.active) throw new AppError('CARD_INACTIVE', 'FORBIDDEN');
    const module = await prisma.organizationModule.findUnique({ where: { orgId_module: { orgId, module: 'WORKFORCE' } } });
    // No row = never provisioned: deny, never default to enabled (same rule as requireModule).
    if (!module?.enabled) throw new AppError('MODULE_DISABLED', 'FORBIDDEN');
    return card;
}

/** Resolves the phone behind a device cookie. Does not look at any card. */
async function resolveSession(deviceToken: string, now: Date) {
    const session = await prisma.deviceSession.findUnique({
        where: { sessionTokenHash: hashToken(deviceToken) },
        include: { employee: { select: { id: true, fullName: true, status: true, organizationId: true } } },
    });
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'UNAUTHORIZED');
    if (session.revokedAt) throw new AppError('SESSION_REVOKED', 'FORBIDDEN');
    // A row whose organization disagrees with its own employee's is corrupt: fail closed.
    if (session.organizationId !== session.employee.organizationId) throw new AppError('SESSION_NOT_FOUND', 'UNAUTHORIZED');
    if (session.employee.status !== 'ACTIVE') throw new AppError('EMPLOYEE_INACTIVE', 'FORBIDDEN');

    if (!session.lastUsedAt || now.getTime() - session.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
        // Best-effort bookkeeping, off the critical path.
        void prisma.deviceSession
            .updateMany({ where: { id: session.id, organizationId: session.organizationId }, data: { lastUsedAt: now } })
            .catch(() => undefined);
    }
    return session;
}

/**
 * One physical tap. The inputs are the card id from the tag URL and the phone's
 * cookies. The caller is identified FIRST (device session or pending registration)
 * and the card is then required to belong to that caller's organization; nothing the
 * client sends can choose the organization.
 *
 * A tap is NOT proof of physical presence: the card id is just a string in a URL.
 * See docs/nfc-attendance.
 *
 * `now` is taken inside the employee's lock when not supplied (tests pass it), so a
 * tap that waited for a pooled connection is timestamped when it is actually recorded.
 */
export async function tap(req: TapRequest, now?: Date): Promise<TapOutcome> {
    // Without any cookie there is nothing to authenticate: refuse before touching the
    // database, so an anonymous caller cannot probe anything.
    if (!req.deviceToken && !req.pendingSecret) throw new AppError('NO_SESSION', 'UNAUTHORIZED');

    if (req.pendingSecret) {
        const pending = await deviceRegistrationService.resolvePending(req.pendingSecret, now);
        await resolveCard(pending.organizationId, req.cardId); // card errors leave the registration unused
        const reg = await deviceRegistrationService.complete(req.pendingSecret, req.userAgent, now);
        return {
            result: { status: 'REGISTRATION_COMPLETE', at: reg.at, debounced: false, employeeName: reg.employeeName },
            newDeviceToken: reg.sessionToken,
        };
    }

    const session = await resolveSession(req.deviceToken!, now ?? new Date());
    const card = await resolveCard(session.organizationId, req.cardId);
    consumeTapBudget(session.id); // after validation: keyed on a real session, never on a raw cookie

    const result = await withLock(
        `employee:${session.employeeId}`,
        async (tx) => {
            // The checks above ran outside the lock; a manager may have revoked the phone or
            // deactivated the employee since. One cheap re-check keeps an in-flight tap from
            // recording after the revoke.
            const live = await tx.deviceSession.findFirst({
                where: { id: session.id, revokedAt: null, employee: { status: 'ACTIVE' } },
                select: { id: true },
            });
            if (!live) throw new AppError('SESSION_REVOKED', 'FORBIDDEN');

            return punchInTx(tx, {
                employeeId: session.employeeId,
                direction: card.direction,
                now: now ?? new Date(),
                source: 'nfc',
                // A rejection is deliberately NOT debounced: it changes nothing, so echoing it would
                // swallow the corrective tap (IN card refused, then the OUT card tapped 2 s later).
                debounceOn: ['CHECK_IN', 'CHECK_OUT', 'REGISTERED'],
            });
        },
        { retryOn: ['P2002'] },
    );
    return { result: { ...result, employeeName: session.employee.fullName } };
}
