import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import { AppError } from '../lib/app-error.js';
import { deviceLabelFromUserAgent } from '../lib/device-label.js';
import { hashToken } from '../lib/token.js';
import { withLock } from '../lib/with-lock.js';

type Tx = Prisma.TransactionClient;

export const REGISTRATION_LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** Token errors after which a stale pending cookie should be dropped (card errors are not terminal). */
export const TERMINAL_TOKEN_ERRORS: ReadonlySet<string> = new Set([
    'TOKEN_NOT_FOUND',
    'TOKEN_ALREADY_USED',
    'TOKEN_SUPERSEDED',
    'TOKEN_EXPIRED',
    'EMPLOYEE_INACTIVE',
]);

const newSecret = () => randomBytes(32).toString('base64url');

/**
 * Looks a registration token up by its hash and checks it. The order matters and
 * is tested: a used token reports ALREADY_USED even if it has also expired, and a
 * superseded one reports SUPERSEDED even while still inside its expiry.
 *
 * The hash is attacker-controlled (it arrives in the pending cookie), so only a
 * SHA-256 hex digest can be real; anything else — e.g. a NUL byte, which
 * Postgres rejects with a 500 — is simply "not found".
 */
async function validateTokenHash(db: Tx | typeof prisma, tokenHash: string, now: Date) {
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new AppError('TOKEN_NOT_FOUND', 'NOT_FOUND');
    // [TOKEN] The org is read from the row this token resolves to, never from the caller.
    const token = await db.registrationToken.findUnique({
        where: { tokenHash },
        include: { employee: { select: { fullName: true, status: true } } },
    });
    if (!token) throw new AppError('TOKEN_NOT_FOUND', 'NOT_FOUND');
    if (token.usedAt) throw new AppError('TOKEN_ALREADY_USED', 'CONFLICT');
    if (token.supersededAt) throw new AppError('TOKEN_SUPERSEDED', 'CONFLICT');
    if (token.expiresAt.getTime() <= now.getTime()) throw new AppError('TOKEN_EXPIRED', 'BAD_REQUEST');
    return token;
}

export const deviceRegistrationService = {
    /**
     * Manager action: issue a single-use link for one employee. Any earlier
     * still-pending link for the same employee is superseded. Only the hash is
     * stored; the raw token exists only in the returned link.
     */
    async sendLink(orgId: string, employeeId: string, now: Date = new Date()) {
        const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true, fullName: true, status: true } });
        if (!employee) throw new AppError('EMPLOYEE_NOT_FOUND', 'NOT_FOUND');
        if (employee.status !== 'ACTIVE') throw new AppError('EMPLOYEE_INACTIVE', 'FORBIDDEN');

        const raw = newSecret();
        const expiresAt = new Date(now.getTime() + REGISTRATION_LINK_TTL_MS);
        await prisma.$transaction([
            prisma.registrationToken.updateMany({ where: { employeeId, organizationId: orgId, usedAt: null, supersededAt: null }, data: { supersededAt: now } }),
            prisma.registrationToken.create({ data: { organizationId: orgId, employeeId, tokenHash: hashToken(raw), expiresAt } }),
        ]);

        const appUrl = (process.env['APP_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
        return { link: `${appUrl}/app/register?token=${raw}`, expiresAt, employeeName: employee.fullName };
    },

    /**
     * The employee's phone opened the link. On success the router sets the
     * short-lived pending cookie to `pendingValue` — a marker that "this browser
     * is mid-registration", NOT the final session.
     */
    async start(rawToken: string, now: Date = new Date()) {
        const tokenHash = hashToken(rawToken);
        const token = await validateTokenHash(prisma, tokenHash, now);
        return { pendingValue: tokenHash, employeeName: token.employee.fullName };
    },

    /**
     * Registration-completion branch of a tap: the employee, holding a pending
     * cookie, tapped a physical card. Any ACTIVE card works — they are proving
     * they can reach the real device, not choosing a direction. The card and the
     * token must belong to the same organization.
     *
     * Card errors leave the token unused so the employee can simply tap again;
     * token errors are terminal (see TERMINAL_TOKEN_ERRORS).
     */
    async complete(pendingHash: string, card: { organizationId: string }, userAgent: string | undefined, now: Date = new Date()) {
        // Peek (unlocked) only to learn WHICH employee to lock; everything is re-validated inside the lock.
        const peek = await validateTokenHash(prisma, pendingHash, now);
        if (peek.organizationId !== card.organizationId) throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');

        return withLock(`employee:${peek.employeeId}`, async (tx) => {
            const token = await validateTokenHash(tx, pendingHash, now);
            if (token.employee.status !== 'ACTIVE') throw new AppError('EMPLOYEE_INACTIVE', 'FORBIDDEN');

            const sessionToken = newSecret();
            await tx.deviceSession.create({
                data: {
                    organizationId: token.organizationId,
                    employeeId: token.employeeId,
                    sessionTokenHash: hashToken(sessionToken),
                    deviceLabel: deviceLabelFromUserAgent(userAgent),
                    lastUsedAt: now,
                },
            });
            await tx.registrationToken.update({ where: { id: token.id }, data: { usedAt: now } });
            await tx.attendanceEvent.create({
                data: { employeeId: token.employeeId, sessionId: null, eventType: 'REGISTERED', scannedAt: now, source: 'nfc' },
            });
            return { sessionToken, employeeName: token.employee.fullName, at: now };
        });
    },

    /** Active (not revoked) phones for the whole org; the web groups them by employee. */
    async listDevices(orgId: string) {
        return prisma.deviceSession.findMany({ where: { organizationId: orgId, revokedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, employeeId: true, deviceLabel: true, createdAt: true, lastUsedAt: true } });
    },

    /** Locks out a lost or compromised phone. Idempotent: revoking twice keeps the first timestamp. */
    async revokeDevice(orgId: string, id: string, now: Date = new Date()) {
        const { count } = await prisma.deviceSession.updateMany({ where: { id, organizationId: orgId, revokedAt: null }, data: { revokedAt: now } });
        if (count === 0) {
            const exists = await prisma.deviceSession.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
            if (!exists) throw new AppError('DEVICE_SESSION_NOT_FOUND', 'NOT_FOUND');
        }
        return { revoked: true as const };
    },
};
