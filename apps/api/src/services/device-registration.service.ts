import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import { AppError } from '../lib/app-error.js';
import { deviceLabelFromUserAgent } from '../lib/device-label.js';
import { hashToken } from '../lib/token.js';
import { withLock } from '../lib/with-lock.js';
import { assertAttendanceMethod } from '../lib/attendance-method.js';

type Tx = Prisma.TransactionClient;

export const REGISTRATION_LINK_TTL_MS = 48 * 60 * 60 * 1000;
/** How long a browser may sit between opening the link and tapping a card. */
export const PENDING_TTL_MS = 10 * 60 * 1000;

/** Token errors after which a stale pending cookie should be dropped (card errors are not terminal). */
export const TERMINAL_TOKEN_ERRORS: ReadonlySet<string> = new Set([
    'TOKEN_NOT_FOUND',
    'TOKEN_ALREADY_USED',
    'TOKEN_SUPERSEDED',
    'TOKEN_EXPIRED',
    'EMPLOYEE_INACTIVE',
]);

const newSecret = () => randomBytes(32).toString('base64url');
/** A secret from newSecret(): 32 random bytes, base64url, so exactly 43 characters. */
const SECRET_SHAPE = /^[A-Za-z0-9_-]{43}$/;

function findByTokenHash(db: Tx | typeof prisma, tokenHash: string) {
    // [TOKEN] The org is read from the row this token resolves to, never from the caller.
    return db.registrationToken.findUnique({ where: { tokenHash }, include: { employee: { select: { fullName: true, status: true } } } });
}

function findByPendingHash(db: Tx | typeof prisma, pendingHash: string) {
    // [TOKEN] Same: the pending secret is the credential; the org comes from the row it resolves to.
    return db.registrationToken.findUnique({ where: { pendingHash }, include: { employee: { select: { fullName: true, status: true } } } });
}

type TokenRow = NonNullable<Awaited<ReturnType<typeof findByTokenHash>>>;

/**
 * The link's own state. The order matters and is tested: a used token reports
 * ALREADY_USED even if it has also expired, and a superseded one reports
 * SUPERSEDED even while still inside its expiry.
 */
function assertUsable(token: TokenRow, now: Date) {
    if (token.usedAt) throw new AppError('TOKEN_ALREADY_USED', 'CONFLICT');
    if (token.supersededAt) throw new AppError('TOKEN_SUPERSEDED', 'CONFLICT');
    if (token.expiresAt.getTime() <= now.getTime()) throw new AppError('TOKEN_EXPIRED', 'BAD_REQUEST');
}

/**
 * Looks a registration link up by the raw token's hash and checks it. The raw
 * token is hashed before any query, so whatever the caller sends is never used
 * as a lookup key directly.
 */
async function validateLink(db: Tx | typeof prisma, rawToken: string, now: Date) {
    const token = await findByTokenHash(db, hashToken(rawToken));
    if (!token) throw new AppError('TOKEN_NOT_FOUND', 'NOT_FOUND');
    assertUsable(token, now);
    return token;
}

/**
 * Looks a registration up by the pending-cookie secret. The cookie is
 * attacker-controlled, so only a value shaped like a real secret is ever hashed
 * and queried (anything else, e.g. a NUL byte which Postgres rejects with a 500,
 * is simply "not found").
 */
async function validatePending(db: Tx | typeof prisma, pendingSecret: string, now: Date) {
    if (!SECRET_SHAPE.test(pendingSecret)) throw new AppError('TOKEN_NOT_FOUND', 'NOT_FOUND');
    const token = await findByPendingHash(db, hashToken(pendingSecret));
    if (!token) throw new AppError('TOKEN_NOT_FOUND', 'NOT_FOUND');
    assertUsable(token, now);
    if (!token.pendingExpiresAt || token.pendingExpiresAt.getTime() <= now.getTime()) throw new AppError('TOKEN_EXPIRED', 'BAD_REQUEST');
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
     * The employee's phone opened the link. The browser is marked
     * "mid-registration" with a fresh RANDOM secret that only this browser holds
     * (its hash is stored on the token, valid 10 minutes). The cookie is never a
     * value taken from the database, so reading the table cannot forge one.
     * Opening the link again in another browser replaces the previous secret.
     */
    async start(rawToken: string, now: Date = new Date()) {
        const token = await validateLink(prisma, rawToken, now);
        await assertAttendanceMethod(token.organizationId, 'NFC');
        const pendingSecret = newSecret();
        const pendingExpiresAt = new Date(now.getTime() + PENDING_TTL_MS);
        await prisma.registrationToken.updateMany({ where: { id: token.id, organizationId: token.organizationId, usedAt: null }, data: { pendingHash: hashToken(pendingSecret), pendingExpiresAt } });
        return { pendingSecret, employeeName: token.employee.fullName };
    },

    /**
     * Which organization a pending-registration cookie belongs to, validated now.
     * Throws a token error (see TERMINAL_TOKEN_ERRORS) if the link is dead. The
     * tap uses this to find the card in THAT organization before consuming anything.
     */
    async resolvePending(pendingSecret: string, now: Date = new Date()) {
        const token = await validatePending(prisma, pendingSecret, now);
        return { organizationId: token.organizationId, employeeId: token.employeeId };
    },

    /**
     * Completes the registration: the employee, holding a pending cookie, tapped a
     * card of their own organization (the caller has already matched the card to
     * `resolvePending`'s organization). Everything is re-validated inside the
     * employee's lock, so two concurrent completions cannot both succeed.
     *
     * Card errors happen before this and leave the token unused so the employee
     * can simply tap again; token errors are terminal (see TERMINAL_TOKEN_ERRORS).
     */
    async complete(pendingSecret: string, userAgent: string | undefined, now: Date = new Date()) {
        const peek = await validatePending(prisma, pendingSecret, now);

        return withLock(`employee:${peek.employeeId}`, async (tx) => {
            const token = await validatePending(tx, pendingSecret, now);
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
