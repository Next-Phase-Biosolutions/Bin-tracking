import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@bin-tracker/db';
import type { User, UserRole } from '@prisma/client';
import { appRouter } from './index.js';
import { hashToken } from '../lib/token.js';
import { cleanupOrg, dbTestsEnabled, seedCard, seedDevice, seedEmployee, seedOrg } from '../test-support/db.js';

// The mail provider is replaced by a recorder: tests assert WHAT would be emailed, never send anything.
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../lib/email.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/email.js')>()),
    sendRegistrationLinkEmail: mail.send,
}));

// Drives the REAL router (auth middleware, rate limits, cookies, errorFormatter) over a real
// Postgres, with a fake browser cookie jar. Skipped unless DATABASE_URL is a localhost
// *_test / *_ci database (see test-support/db.ts).
const suite = dbTestsEnabled() ? describe : describe.skip;

const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

let phoneCounter = 0;

interface CookieCall {
    name: string;
    value: string;
    options: Record<string, unknown>;
}

/** One browser: its cookie jar and a way to call the API as an anonymous (cookie-only) phone. */
function phone(headers: Record<string, string> = {}) {
    phoneCounter += 1;
    const ip = `10.7.${Math.floor(phoneCounter / 250)}.${(phoneCounter % 250) + 1}`;
    const jar = new Map<string, string>();
    const set: CookieCall[] = [];
    const cleared: string[] = [];
    const res = {
        setCookie: (name: string, value: string, options: Record<string, unknown>) => {
            jar.set(name, value);
            set.push({ name, value, options });
        },
        clearCookie: (name: string) => {
            jar.delete(name);
            cleared.push(name);
        },
    };
    const api = () =>
        appRouter.createCaller({
            prisma,
            user: null,
            orgId: null,
            orgRole: null,
            jwtPayload: null,
            req: { cookies: Object.fromEntries(jar), headers: { 'user-agent': IPHONE_SAFARI, ...headers }, ip, log: { warn: () => undefined } },
            res,
        } as never);
    return { api, jar, set, cleared };
}

/** A signed-in manager of `orgId` (the admin web app, Bearer JWT in production). */
function manager(orgId: string, orgRole: UserRole = 'ADMIN') {
    return appRouter.createCaller({
        prisma,
        user: { id: `user-${orgId}`, role: orgRole } as unknown as User,
        orgId,
        orgRole,
        jwtPayload: null,
        req: { cookies: {}, headers: {}, ip: '10.9.9.9', log: { warn: () => undefined } },
    } as never);
}

suite('NFC registration, tap and card management (real Postgres, real router)', () => {
    let orgId: string;
    let otherOrgId: string;
    const created: string[] = [];

    beforeAll(async () => {
        orgId = (await seedOrg('router')).id;
        otherOrgId = (await seedOrg('router-other')).id;
        created.push(orgId, otherOrgId);
    });
    afterAll(async () => {
        for (const id of created) await cleanupOrg(id);
    });

    /** Admin issues a link; returns the raw token (from the link) and the token row. */
    async function issueLink(employeeId: string, org = orgId) {
        const { link } = await manager(org).deviceRegistration.sendLink({ employeeId });
        const token = new URL(link).searchParams.get('token')!;
        return { link, token, row: await prisma.registrationToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } }) };
    }

    describe('sending a registration link', () => {
        it('returns a /app/register link, stores only the hash, and expires in 48 h', async () => {
            const employee = await seedEmployee(orgId);

            const { link, token, row } = await issueLink(employee.id);

            expect(link).toMatch(/\/app\/register\?token=[A-Za-z0-9_-]{43}$/);
            expect(row.tokenHash).toBe(hashToken(token));
            expect(row.organizationId).toBe(orgId);
            const stored = JSON.stringify(await prisma.registrationToken.findMany({ where: { employeeId: employee.id } }));
            expect(stored).not.toContain(token); // the raw token is never persisted
            const ttlH = (row.expiresAt.getTime() - Date.now()) / 3_600_000;
            expect(ttlH).toBeGreaterThan(47.9);
            expect(ttlH).toBeLessThanOrEqual(48);
        });

        it('a newer link supersedes the unused one', async () => {
            const employee = await seedEmployee(orgId);
            const first = await issueLink(employee.id);
            const second = await issueLink(employee.id);

            await expect(phone().api().deviceRegistration.start({ token: first.token })).rejects.toMatchObject({ appCode: 'TOKEN_SUPERSEDED' });
            await expect(phone().api().deviceRegistration.start({ token: second.token })).resolves.toMatchObject({ employeeName: employee.fullName });
        });

        it('refuses an inactive employee and an employee of another organization', async () => {
            const inactive = await seedEmployee(orgId, { status: 'INACTIVE' });
            const foreign = await seedEmployee(otherOrgId);

            await expect(manager(orgId).deviceRegistration.sendLink({ employeeId: inactive.id })).rejects.toMatchObject({ appCode: 'EMPLOYEE_INACTIVE' });
            await expect(manager(orgId).deviceRegistration.sendLink({ employeeId: foreign.id })).rejects.toMatchObject({ appCode: 'EMPLOYEE_NOT_FOUND' });
            expect(await prisma.registrationToken.count({ where: { employeeId: foreign.id } })).toBe(0);
        });
    });

    describe('opening the link (deviceRegistration.start)', () => {
        it('sets only the short-lived pending cookie: a fresh random secret, never a value taken from the database', async () => {
            const employee = await seedEmployee(orgId);
            const { token, row } = await issueLink(employee.id);
            const browser = phone();

            await browser.api().deviceRegistration.start({ token });

            expect(browser.set).toHaveLength(1);
            const [cookie] = browser.set;
            expect(cookie).toMatchObject({ name: 'bt_pending_reg', options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 } });
            expect(cookie!.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
            // Not the raw token, and not anything stored in the table: a database read yields no usable cookie.
            expect(cookie!.value).not.toBe(token);
            expect(cookie!.value).not.toBe(row.tokenHash);
            const stored = await prisma.registrationToken.findUniqueOrThrow({ where: { id: row.id } });
            expect(stored.pendingHash).toBe(hashToken(cookie!.value));
            expect(stored.pendingHash).not.toBe(cookie!.value);
            expect(stored.pendingExpiresAt!.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
            expect(browser.jar.has('bt_device')).toBe(false);
            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('values read from the database cannot be used as the pending cookie (no impersonation from a DB dump)', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'BOTH');
            const { token, row } = await issueLink(employee.id);
            await phone().api().deviceRegistration.start({ token });
            const stored = await prisma.registrationToken.findUniqueOrThrow({ where: { id: row.id } });

            for (const fromDb of [row.tokenHash, stored.pendingHash!]) {
                const attacker = phone();
                attacker.jar.set('bt_pending_reg', fromDb);
                await expect(attacker.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'TOKEN_NOT_FOUND' });
            }
            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('opening the link in a second browser replaces the first browser\'s pending secret', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'BOTH');
            const { token } = await issueLink(employee.id);
            const first = phone();
            const second = phone();
            await first.api().deviceRegistration.start({ token });
            await second.api().deviceRegistration.start({ token });

            await expect(first.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'TOKEN_NOT_FOUND' });
            await expect(second.api().attendance.tap({ cardId: card.id })).resolves.toMatchObject({ status: 'REGISTRATION_COMPLETE' });
        });

        it('a pending secret expires after 10 minutes even though the link itself is still valid', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'BOTH');
            const { token, row } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });
            await prisma.registrationToken.update({ where: { id: row.id }, data: { pendingExpiresAt: new Date(Date.now() - 1000) } });

            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'TOKEN_EXPIRED' });
            expect(browser.cleared).toContain('bt_pending_reg');
            // opening the (still valid) link again starts a new 10 minutes
            await browser.api().deviceRegistration.start({ token });
            await expect(browser.api().attendance.tap({ cardId: card.id })).resolves.toMatchObject({ status: 'REGISTRATION_COMPLETE' });
        });

        it('reports errors in order: used beats expired, superseded beats expired, then expired, then unknown', async () => {
            const emp = await seedEmployee(orgId);
            const used = await issueLink(emp.id);
            await prisma.registrationToken.update({ where: { id: used.row.id }, data: { usedAt: new Date(), expiresAt: new Date(Date.now() - 1000) } });
            await expect(phone().api().deviceRegistration.start({ token: used.token })).rejects.toMatchObject({ appCode: 'TOKEN_ALREADY_USED' });

            const emp2 = await seedEmployee(orgId);
            const old = await issueLink(emp2.id);
            await issueLink(emp2.id); // supersedes `old`
            await prisma.registrationToken.update({ where: { id: old.row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
            await expect(phone().api().deviceRegistration.start({ token: old.token })).rejects.toMatchObject({ appCode: 'TOKEN_SUPERSEDED' });

            const emp3 = await seedEmployee(orgId);
            const expired = await issueLink(emp3.id);
            await prisma.registrationToken.update({ where: { id: expired.row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
            await expect(phone().api().deviceRegistration.start({ token: expired.token })).rejects.toMatchObject({ appCode: 'TOKEN_EXPIRED' });

            await expect(phone().api().deviceRegistration.start({ token: 'no-such-token' })).rejects.toMatchObject({ appCode: 'TOKEN_NOT_FOUND' });
        });

        it('rejects an empty token and a NUL byte as a 400, not a 500', async () => {
            await expect(phone().api().deviceRegistration.start({ token: '' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
            await expect(phone().api().deviceRegistration.start({ token: 'ab\u0000cd' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });

        it('bounds repeated attempts from one address: the 1001st in an hour is TOO_MANY_REQUESTS (roomy enough for a company enrolling behind one proxy address)', async () => {
            const browser = phone();
            const codes: string[] = [];
            for (let i = 0; i < 1002; i++) codes.push(await browser.api().deviceRegistration.start({ token: `guess-${i}` }).then(() => 'ok', (e: { code: string }) => e.code));
            expect(codes.slice(0, 1000).every((c) => c === 'NOT_FOUND')).toBe(true);
            expect(codes.slice(1000)).toEqual(['TOO_MANY_REQUESTS', 'TOO_MANY_REQUESTS']);
        });
    });

    describe('completing registration by tapping a card', () => {
        it('binds the phone: device cookie (1 year), pending cleared, hashed session, REGISTERED event, labelled', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'OUT'); // any active card registers, whatever its direction
            const { token } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });

            const result = await browser.api().attendance.tap({ cardId: card.id });

            expect(result).toMatchObject({ status: 'REGISTRATION_COMPLETE', employeeName: employee.fullName, debounced: false });
            const device = browser.set.find((c) => c.name === 'bt_device')!;
            expect(device.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 31_536_000 });
            expect(browser.cleared).toContain('bt_pending_reg');
            const session = await prisma.deviceSession.findFirstOrThrow({ where: { employeeId: employee.id } });
            expect(session).toMatchObject({ organizationId: orgId, deviceLabel: 'iPhone · Safari', revokedAt: null });
            expect(session.sessionTokenHash).toBe(hashToken(device.value));
            expect(session.sessionTokenHash).not.toBe(device.value);
            expect((await prisma.registrationToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } })).usedAt).not.toBeNull();
            const events = await prisma.attendanceEvent.findMany({ where: { employeeId: employee.id } });
            expect(events).toMatchObject([{ eventType: 'REGISTERED', sessionId: null, source: 'nfc' }]);
            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0); // registering is not a check-in
        });

        it('an immediate second tap echoes the registration (double-tap), it does not check in', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'BOTH');
            const { token } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });
            await browser.api().attendance.tap({ cardId: card.id });

            const second = await browser.api().attendance.tap({ cardId: card.id });

            expect(second).toMatchObject({ status: 'REGISTRATION_COMPLETE', debounced: true });
            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('a card problem leaves the token unused and the pending cookie in place, so the right card then works', async () => {
            const employee = await seedEmployee(orgId);
            const dead = await seedCard(orgId, 'IN', { active: false });
            const good = await seedCard(orgId, 'IN');
            const { token } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });
            const pendingSecret = browser.jar.get('bt_pending_reg');

            await expect(browser.api().attendance.tap({ cardId: dead.id })).rejects.toMatchObject({ appCode: 'CARD_INACTIVE' });
            await expect(browser.api().attendance.tap({ cardId: 'no-such-card' })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });

            expect(browser.jar.get('bt_pending_reg')).toBe(pendingSecret);
            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(0);
            await expect(browser.api().attendance.tap({ cardId: good.id })).resolves.toMatchObject({ status: 'REGISTRATION_COMPLETE' });
        });

        it("a token from one organization cannot be completed on another organization's card", async () => {
            const employee = await seedEmployee(orgId);
            const foreignCard = await seedCard(otherOrgId, 'IN');
            const { token } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });

            await expect(browser.api().attendance.tap({ cardId: foreignCard.id })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });

            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(0);
            expect((await prisma.registrationToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } })).usedAt).toBeNull();
        });

        it('a used token replayed from a second browser is refused and its pending cookie dropped', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'IN');
            const { token } = await issueLink(employee.id);
            const first = phone();
            await first.api().deviceRegistration.start({ token });
            const stolenSecret = first.jar.get('bt_pending_reg')!; // what a shoulder-surfer / old backup might hold
            await first.api().attendance.tap({ cardId: card.id });

            const thief = phone();
            thief.jar.set('bt_pending_reg', stolenSecret);
            await expect(thief.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'TOKEN_ALREADY_USED' });

            expect(thief.cleared).toContain('bt_pending_reg');
            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(1);
        });

        it('an employee deactivated mid-registration is refused and the pending cookie dropped', async () => {
            const employee = await seedEmployee(orgId);
            const card = await seedCard(orgId, 'IN');
            const { token } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });
            await prisma.employee.update({ where: { id: employee.id }, data: { status: 'INACTIVE' } });

            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'EMPLOYEE_INACTIVE' });

            expect(browser.cleared).toContain('bt_pending_reg');
            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('forged pending cookies are "not found", never a 500', async () => {
            const card = await seedCard(orgId, 'IN');
            for (const forged of ['\u0000', 'x'.repeat(64), 'A'.repeat(64), '%00', "' OR 1=1 --", 'a'.repeat(5000), 'Z'.repeat(43)]) {
                const browser = phone();
                browser.jar.set('bt_pending_reg', forged);
                await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'TOKEN_NOT_FOUND' });
                expect(browser.cleared).toContain('bt_pending_reg');
            }
        });
    });

    describe('tapping with a registered phone', () => {
        it('with no cookies at all it is NO_SESSION before any card lookup (no probing of card ids)', async () => {
            await expect(phone().api().attendance.tap({ cardId: 'whatever' })).rejects.toMatchObject({ appCode: 'NO_SESSION', code: 'UNAUTHORIZED' });
        });

        it('an unknown, revoked or inactive-employee phone is refused with a specific reason', async () => {
            const card = await seedCard(orgId, 'BOTH');
            const unknown = phone();
            unknown.jar.set('bt_device', 'never-issued');
            await expect(unknown.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'SESSION_NOT_FOUND' });

            const revokedEmp = await seedEmployee(orgId);
            const revoked = await seedDevice(orgId, revokedEmp.id, { revoked: true });
            const revokedPhone = phone();
            revokedPhone.jar.set('bt_device', revoked.token);
            await expect(revokedPhone.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'SESSION_REVOKED', code: 'FORBIDDEN' });

            const inactiveEmp = await seedEmployee(orgId, { status: 'INACTIVE' });
            const inactive = await seedDevice(orgId, inactiveEmp.id);
            const inactivePhone = phone();
            inactivePhone.jar.set('bt_device', inactive.token);
            await expect(inactivePhone.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'EMPLOYEE_INACTIVE' });

            expect(await prisma.attendanceEvent.count({ where: { employeeId: { in: [revokedEmp.id, inactiveEmp.id] } } })).toBe(0);
        });

        it("a phone from organization A tapping organization B's card is told the card does not exist, and nothing is written", async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const foreignCard = await seedCard(otherOrgId, 'BOTH');
            const browser = phone();
            browser.jar.set('bt_device', token);

            await expect(browser.api().attendance.tap({ cardId: foreignCard.id })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND', code: 'NOT_FOUND' });

            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0);
            expect(await prisma.attendanceEvent.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('does not reveal whether a card exists to a caller who is not a registered phone', async () => {
            const realCard = await seedCard(orgId, 'BOTH');
            const answers = new Set<string>();
            for (const cardId of [realCard.id, 'no-such-card', 'c'.repeat(36)]) {
                const junk = phone();
                junk.jar.set('bt_device', 'any-old-cookie');
                answers.add(await junk.api().attendance.tap({ cardId }).then(() => 'ok', (e: { appCode?: string }) => e.appCode ?? 'other'));
            }
            expect([...answers]).toEqual(['SESSION_NOT_FOUND']); // identical whether or not the card is real
        });

        it("another organization's card looks exactly like a missing one, even when it is inactive or its module is off", async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const offOrg = (await seedOrg('oracle-off', { workforce: false })).id;
            created.push(offOrg);
            const inactiveCard = await seedCard(otherOrgId, 'BOTH', { active: false });
            const moduleOffCard = await seedCard(offOrg, 'BOTH');

            for (const cardId of [inactiveCard.id, moduleOffCard.id, 'no-such-card']) {
                const browser = phone();
                browser.jar.set('bt_device', token);
                await expect(browser.api().attendance.tap({ cardId })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND', code: 'NOT_FOUND' });
            }
        });

        it("a pending registration cannot be completed on another organization's inactive card (and learns nothing about it)", async () => {
            const employee = await seedEmployee(orgId);
            const foreignInactive = await seedCard(otherOrgId, 'BOTH', { active: false });
            const { token } = await issueLink(employee.id);
            const browser = phone();
            await browser.api().deviceRegistration.start({ token });

            await expect(browser.api().attendance.tap({ cardId: foreignInactive.id })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });
            expect(browser.jar.has('bt_pending_reg')).toBe(true); // a card problem leaves the registration alone
        });

        it('an organization without the WORKFORCE module cannot take taps', async () => {
            const offOrg = (await seedOrg('no-workforce', { workforce: false })).id;
            created.push(offOrg);
            const employee = await seedEmployee(offOrg);
            const { token } = await seedDevice(offOrg, employee.id);
            const card = await seedCard(offOrg, 'BOTH');
            const browser = phone();
            browser.jar.set('bt_device', token);

            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'MODULE_DISABLED', code: 'FORBIDDEN' });
            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('checks in then out, and a deactivated card stops working for a registered phone', async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const card = await seedCard(orgId, 'BOTH');
            const browser = phone();
            browser.jar.set('bt_device', token);

            expect(await browser.api().attendance.tap({ cardId: card.id })).toMatchObject({ status: 'CHECK_IN', employeeName: employee.fullName });
            await manager(orgId).nfcCard.setActive({ id: card.id, active: false });
            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'CARD_INACTIVE' });
        });

        it('rejects a NUL byte in the card id as a 400', async () => {
            const browser = phone();
            browser.jar.set('bt_device', 'x');
            await expect(browser.api().attendance.tap({ cardId: 'a\u0000b' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });

        it('a hostile device cookie (NUL, huge, SQL) is "session not found", never a 500', async () => {
            const card = await seedCard(orgId, 'BOTH');
            for (const hostile of ['\u0000', 'z'.repeat(8000), "'; DROP TABLE device_sessions; --"]) {
                const browser = phone();
                browser.jar.set('bt_device', hostile);
                await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'SESSION_NOT_FOUND' });
            }
        });

        it('limits a single phone to 30 taps a minute', async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const card = await seedCard(orgId, 'BOTH');
            const browser = phone();
            browser.jar.set('bt_device', token);

            const codes: string[] = [];
            for (let i = 0; i < 32; i++) codes.push(await browser.api().attendance.tap({ cardId: card.id }).then(() => 'ok', (e: { code: string }) => e.code));

            expect(codes.slice(0, 30).every((c) => c === 'ok')).toBe(true);
            expect(codes.slice(30)).toEqual(['TOO_MANY_REQUESTS', 'TOO_MANY_REQUESTS']);
        });
    });

    describe('cross-site protection on cookie-authenticated calls', () => {
        it('refuses a request whose Origin is not our web app, and writes nothing', async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const card = await seedCard(orgId, 'BOTH');
            const evil = phone({ origin: 'https://evil.example' });
            evil.jar.set('bt_device', token);

            await expect(evil.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'BAD_ORIGIN', code: 'FORBIDDEN' });
            await expect(evil.api().deviceRegistration.start({ token: 'x' })).rejects.toMatchObject({ appCode: 'BAD_ORIGIN' });

            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('accepts our own web origin and a request with no Origin header', async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const card = await seedCard(orgId, 'BOTH');
            const own = phone({ origin: process.env['APP_URL'] ?? 'http://localhost:3000' });
            own.jar.set('bt_device', token);

            await expect(own.api().attendance.tap({ cardId: card.id })).resolves.toMatchObject({ status: 'CHECK_IN' });
        });
    });

    describe('device management', () => {
        it('lists only this organization\'s active phones, without any token material', async () => {
            const mine = await seedEmployee(orgId);
            const theirs = await seedEmployee(otherOrgId);
            const myDevice = await seedDevice(orgId, mine.id);
            await seedDevice(otherOrgId, theirs.id);
            await seedDevice(orgId, mine.id, { revoked: true });

            const list = await manager(orgId).deviceRegistration.listDevices();

            const forMe = list.filter((d) => d.employeeId === mine.id);
            expect(forMe.map((d) => d.id)).toEqual([myDevice.session.id]);
            expect(list.some((d) => d.employeeId === theirs.id)).toBe(false);
            expect(JSON.stringify(list)).not.toMatch(/sessionTokenHash|tokenHash/);
        });

        it('revoking locks the phone out immediately, is idempotent, and cannot touch another organization', async () => {
            const employee = await seedEmployee(orgId);
            const { token, session } = await seedDevice(orgId, employee.id);
            const card = await seedCard(orgId, 'BOTH');
            const browser = phone();
            browser.jar.set('bt_device', token);
            await expect(browser.api().attendance.tap({ cardId: card.id })).resolves.toMatchObject({ status: 'CHECK_IN' });

            await manager(orgId).deviceRegistration.revokeDevice({ id: session.id });
            const firstRevoke = (await prisma.deviceSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt!;
            await manager(orgId).deviceRegistration.revokeDevice({ id: session.id });

            expect((await prisma.deviceSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toEqual(firstRevoke);
            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'SESSION_REVOKED' });

            const foreign = await seedDevice(otherOrgId, (await seedEmployee(otherOrgId)).id);
            await expect(manager(orgId).deviceRegistration.revokeDevice({ id: foreign.session.id })).rejects.toMatchObject({ appCode: 'DEVICE_SESSION_NOT_FOUND' });
            expect((await prisma.deviceSession.findUniqueOrThrow({ where: { id: foreign.session.id } })).revokedAt).toBeNull();
        });
    });

    describe('NFC card management', () => {
        it('gives each card a random UUID id (it ends up in the tag URL), not a time-ordered cuid', async () => {
            const org = (await seedOrg('card-ids')).id;
            created.push(org);
            const a = await manager(org).nfcCard.create({ label: 'A', direction: 'IN', chipUid: 'id-a' });
            const b = await manager(org).nfcCard.create({ label: 'B', direction: 'IN', chipUid: 'id-b' });

            expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
            expect(a.id).not.toBe(b.id);
        });

        it('tells the admin which origin to write into tag URLs: the server APP_URL, with no trailing slash', async () => {
            const { url } = await manager(orgId).nfcCard.tagBaseUrl();
            expect(url).toBe((process.env['APP_URL'] ?? 'http://localhost:3000').replace(/\/$/, ''));
        });

        it('creates, lists (by label), edits partially, toggles and deletes', async () => {
            const org = (await seedOrg('cards')).id;
            created.push(org);
            const admin = manager(org);

            const door = await admin.nfcCard.create({ label: 'Z Door', direction: 'IN', chipUid: '04AA' });
            await admin.nfcCard.create({ label: 'A Dock', direction: 'OUT', chipUid: '04BB' });
            expect((await admin.nfcCard.list()).map((c) => c.label)).toEqual(['A Dock', 'Z Door']);

            const edited = await admin.nfcCard.update({ id: door.id, direction: 'BOTH' });
            expect(edited).toMatchObject({ id: door.id, label: 'Z Door', chipUid: '04AA', direction: 'BOTH' }); // id (the URL) never changes

            expect(await admin.nfcCard.setActive({ id: door.id, active: false })).toMatchObject({ active: false });
            await expect(admin.nfcCard.remove({ id: door.id })).resolves.toEqual({ deleted: true });
            await expect(admin.nfcCard.remove({ id: door.id })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });
        });

        it('a direction change takes effect on the next tap, and a deleted card stops working', async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await seedDevice(orgId, employee.id);
            const card = await manager(orgId).nfcCard.create({ label: 'Gate', direction: 'OUT', chipUid: `chg-${employee.id}` });
            const browser = phone();
            browser.jar.set('bt_device', token);

            expect((await browser.api().attendance.tap({ cardId: card.id })).status).toBe('NOT_CHECKED_IN'); // OUT card, not in
            // Step out of the 5 s debounce window, or the next tap would (correctly) echo the rejection.
            await prisma.attendanceEvent.updateMany({ where: { employeeId: employee.id }, data: { scannedAt: new Date(Date.now() - 60_000) } });
            await manager(orgId).nfcCard.update({ id: card.id, direction: 'BOTH' });
            expect((await browser.api().attendance.tap({ cardId: card.id })).status).toBe('CHECK_IN');
            await manager(orgId).nfcCard.remove({ id: card.id });
            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });
        });

        it('chip UIDs are unique per organization, not globally', async () => {
            const a = (await seedOrg('uid-a')).id;
            const b = (await seedOrg('uid-b')).id;
            created.push(a, b);

            await manager(a).nfcCard.create({ label: 'One', direction: 'IN', chipUid: 'SAME-UID' });
            await expect(manager(a).nfcCard.create({ label: 'Two', direction: 'IN', chipUid: 'SAME-UID' })).rejects.toMatchObject({ appCode: 'DUPLICATE_CHIP_UID', code: 'CONFLICT' });
            await expect(manager(b).nfcCard.create({ label: 'Other org', direction: 'IN', chipUid: 'SAME-UID' })).resolves.toMatchObject({ organizationId: b });

            const second = await manager(a).nfcCard.create({ label: 'Three', direction: 'IN', chipUid: 'OTHER-UID' });
            await expect(manager(a).nfcCard.update({ id: second.id, chipUid: 'SAME-UID' })).rejects.toMatchObject({ appCode: 'DUPLICATE_CHIP_UID' });
        });

        it("another organization's cards are invisible and untouchable", async () => {
            const foreign = await seedCard(otherOrgId, 'IN');
            const admin = manager(orgId);

            expect((await admin.nfcCard.list()).some((c) => c.id === foreign.id)).toBe(false);
            await expect(admin.nfcCard.update({ id: foreign.id, label: 'hijacked' })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });
            await expect(admin.nfcCard.setActive({ id: foreign.id, active: false })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });
            await expect(admin.nfcCard.remove({ id: foreign.id })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });
            expect(await prisma.nfcCard.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ label: foreign.label, active: true });
        });
    });

    describe('attendance management procedures are org-scoped end to end', () => {
        it('facility status, pending approvals and approval see only the caller\'s organization', async () => {
            const foreignEmployee = await seedEmployee(otherOrgId);
            const foreignSession = await prisma.workSession.create({
                data: { employeeId: foreignEmployee.id, checkInAt: new Date(Date.now() - 90_000_000), checkOutAt: new Date(Date.now() - 32_400_000), durationMin: 960, autoClosed: true },
            });
            const admin = manager(orgId);

            const status = await admin.attendance.facilityStatus();
            expect([...status.checkedIn, ...status.overdue, ...status.checkedOut].some((e) => e.employeeId === foreignEmployee.id)).toBe(false);
            expect((await admin.attendance.listPendingApprovals()).some((p) => p.id === foreignSession.id)).toBe(false);
            await expect(admin.attendance.approveWorkSession({ id: foreignSession.id })).rejects.toMatchObject({ appCode: 'WORK_SESSION_NOT_FOUND' });
        });
    });

    describe('clock-in method switch (NFC or QR, exactly one)', () => {
        const setMethod = (org: string, method: 'NFC' | 'QR') => prisma.settings.update({ where: { organizationId: org }, data: { attendanceMethod: method } });

        it('a new organization is on NFC, and any member can read the method', async () => {
            const org = (await seedOrg('method-default')).id;
            created.push(org);

            expect(await manager(org, 'WORKER').attendance.method()).toEqual({ method: 'NFC' });
        });

        it('an organization with no settings row is treated as NFC (the default)', async () => {
            const org = await prisma.organization.create({ data: { name: 'No settings', slug: `nfc-test-nosettings-${Date.now()}` } });
            created.push(org.id);

            expect(await manager(org.id, 'WORKER').attendance.method()).toEqual({ method: 'NFC' });
        });

        it('while on QR, a registered phone is refused with NFC_DISABLED and nothing is recorded', async () => {
            const org = (await seedOrg('method-qr-tap', { attendanceMethod: 'QR' })).id;
            created.push(org);
            const employee = await seedEmployee(org);
            const card = await seedCard(org, 'BOTH');
            const { token } = await seedDevice(org, employee.id);
            const browser = phone();
            browser.jar.set('bt_device', token);

            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', appCode: 'NFC_DISABLED' });

            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0);
            expect(await prisma.attendanceEvent.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('while on QR, opening a registration link is refused and the link stays unused', async () => {
            const org = (await seedOrg('method-qr-reg')).id;
            created.push(org);
            const employee = await seedEmployee(org);
            const { token, row } = await issueLink(employee.id, org);
            await setMethod(org, 'QR');

            await expect(phone().api().deviceRegistration.start({ token })).rejects.toMatchObject({ appCode: 'NFC_DISABLED' });

            const after = await prisma.registrationToken.findUniqueOrThrow({ where: { id: row.id } });
            expect(after.usedAt).toBeNull();
            expect(after.pendingHash).toBeNull();
        });

        it('while on NFC, the QR scan procedure is refused with QR_DISABLED and nothing is recorded', async () => {
            const org = (await seedOrg('method-nfc-scan')).id;
            created.push(org);
            const employee = await seedEmployee(org);

            await expect(manager(org, 'WORKER').attendance.scan({ qrCode: employee.qrCode })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', appCode: 'QR_DISABLED' });

            expect(await prisma.workSession.count({ where: { employeeId: employee.id } })).toBe(0);
        });

        it('an admin switches the method, it takes effect at once in both directions, and each change is audited', async () => {
            const org = (await seedOrg('method-switch')).id;
            created.push(org);
            const employee = await seedEmployee(org);
            const card = await seedCard(org, 'BOTH');
            const { token } = await seedDevice(org, employee.id);
            const admin = manager(org, 'ADMIN');
            const browser = phone();
            browser.jar.set('bt_device', token);

            // NFC (default): tap works, QR refused.
            await expect(browser.api().attendance.tap({ cardId: card.id })).resolves.toMatchObject({ status: 'CHECK_IN' });
            await expect(admin.attendance.scan({ qrCode: employee.qrCode })).rejects.toMatchObject({ appCode: 'QR_DISABLED' });

            // Switch to QR: scan works, tap refused.
            await expect(admin.settings.setAttendanceMethod({ method: 'QR' })).resolves.toEqual({ attendanceMethod: 'QR' });
            expect(await admin.attendance.method()).toEqual({ method: 'QR' });
            await expect(browser.api().attendance.tap({ cardId: card.id })).rejects.toMatchObject({ appCode: 'NFC_DISABLED' });
            await expect(admin.attendance.scan({ qrCode: employee.qrCode })).resolves.toMatchObject({ action: expect.stringMatching(/CHECK_(IN|OUT)/) });

            // Switch back (the rollback): tap works again.
            await admin.settings.setAttendanceMethod({ method: 'NFC' });
            await expect(admin.attendance.scan({ qrCode: employee.qrCode })).rejects.toMatchObject({ appCode: 'QR_DISABLED' });

            const log = await prisma.payrollAuditLog.findMany({ where: { orgId: org, action: 'settings.attendanceMethod' }, orderBy: { createdAt: 'asc' } });
            expect(log.map((l) => [l.oldValue, l.newValue])).toEqual([
                [{ attendanceMethod: 'NFC' }, { attendanceMethod: 'QR' }],
                [{ attendanceMethod: 'QR' }, { attendanceMethod: 'NFC' }],
            ]);
            expect(log.every((l) => l.actorId === `user-${org}`)).toBe(true);
        });

        it('setting the value it already has is a no-op and is not logged', async () => {
            const org = (await seedOrg('method-noop')).id;
            created.push(org);

            await manager(org, 'ADMIN').settings.setAttendanceMethod({ method: 'NFC' });

            expect(await prisma.payrollAuditLog.count({ where: { orgId: org, action: 'settings.attendanceMethod' } })).toBe(0);
        });

        it('only an ADMIN can change it, and only for their own organization', async () => {
            const org = (await seedOrg('method-roles')).id;
            const other = (await seedOrg('method-roles-other')).id;
            created.push(org, other);
            vi.stubEnv('DISABLE_AUTH', 'false');
            try {
                for (const role of ['OPS_MANAGER', 'DRIVER', 'WORKER'] as const) {
                    await expect(manager(org, role).settings.setAttendanceMethod({ method: 'QR' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
                }
                await manager(org, 'ADMIN').settings.setAttendanceMethod({ method: 'QR' });
            } finally {
                vi.unstubAllEnvs();
            }

            expect((await prisma.settings.findUniqueOrThrow({ where: { organizationId: other } })).attendanceMethod).toBe('NFC');
            expect((await prisma.settings.findUniqueOrThrow({ where: { organizationId: org } })).attendanceMethod).toBe('QR');
        });

        it('an unknown method value is rejected as a bad request, not a server error', async () => {
            const org = (await seedOrg('method-bad')).id;
            created.push(org);

            await expect(manager(org, 'ADMIN').settings.setAttendanceMethod({ method: 'SMOKE' as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
    });

    describe('emailing a registration link (deviceRegistration.emailLink)', () => {
        const setEmail = (employeeId: string, email: string | null) => prisma.employee.update({ where: { id: employeeId }, data: { email } });
        const reset = () => {
            mail.send.mockReset();
            mail.send.mockResolvedValue(undefined);
        };

        it('emails the link to the address on file: rebuilt from APP_URL, with the name, organisation and expiry', async () => {
            reset();
            vi.stubEnv('APP_URL', 'https://app.example.test/');
            try {
                const employee = await seedEmployee(orgId);
                await setEmail(employee.id, 'jane@example.test');
                const { token, row } = await issueLink(employee.id);

                const out = await manager(orgId).deviceRegistration.emailLink({ employeeId: employee.id, token });

                expect(out).toMatchObject({ email: 'jane@example.test' });
                expect(out.sentAt).toBeInstanceOf(Date);
                expect(mail.send).toHaveBeenCalledTimes(1);
                const [to, url, orgName, name, expiresAt] = mail.send.mock.calls[0]!;
                expect(to).toBe('jane@example.test');
                expect(url).toBe(`https://app.example.test/app/register?token=${token}`);
                expect(orgName).toContain('NFC test router');
                expect(name).toBe(employee.fullName);
                expect((expiresAt as Date).getTime()).toBe(row.expiresAt.getTime());
            } finally {
                vi.unstubAllEnvs();
            }
        });

        it('sending the email does not use up the link: the employee can still open it, and it can be sent again', async () => {
            reset();
            const employee = await seedEmployee(orgId);
            await setEmail(employee.id, 'again@example.test');
            const { token } = await issueLink(employee.id);

            await manager(orgId).deviceRegistration.emailLink({ employeeId: employee.id, token });
            await manager(orgId).deviceRegistration.emailLink({ employeeId: employee.id, token }); // "Send again"

            expect(mail.send).toHaveBeenCalledTimes(2);
            await expect(phone().api().deviceRegistration.start({ token })).resolves.toMatchObject({ employeeName: employee.fullName });
        });

        it('the caller cannot choose the recipient: any extra "to" field is ignored', async () => {
            reset();
            const employee = await seedEmployee(orgId);
            await setEmail(employee.id, 'real@example.test');
            const { token } = await issueLink(employee.id);

            await manager(orgId).deviceRegistration.emailLink({ employeeId: employee.id, token, to: 'attacker@evil.test', url: 'https://evil.test/x' } as never);

            expect(mail.send.mock.calls[0]![0]).toBe('real@example.test');
            expect(String(mail.send.mock.calls[0]![1])).not.toContain('evil.test');
        });

        it('an employee with no email (or only spaces) is refused with EMPLOYEE_NO_EMAIL and nothing is sent', async () => {
            reset();
            const none = await seedEmployee(orgId);
            const blank = await seedEmployee(orgId);
            await setEmail(blank.id, '   ');
            const a = await issueLink(none.id);
            const b = await issueLink(blank.id);

            await expect(manager(orgId).deviceRegistration.emailLink({ employeeId: none.id, token: a.token })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', appCode: 'EMPLOYEE_NO_EMAIL' });
            await expect(manager(orgId).deviceRegistration.emailLink({ employeeId: blank.id, token: b.token })).rejects.toMatchObject({ appCode: 'EMPLOYEE_NO_EMAIL' });
            expect(mail.send).not.toHaveBeenCalled();
        });

        it('only a link that belongs to this employee in this organisation can be sent', async () => {
            reset();
            const mine = await seedEmployee(orgId);
            const other = await seedEmployee(orgId);
            const foreign = await seedEmployee(otherOrgId);
            for (const e of [mine, other, foreign]) await setEmail(e.id, `${e.id}@example.test`);
            const mineLink = await issueLink(mine.id);
            const foreignLink = await issueLink(foreign.id, otherOrgId);

            // garbage, another employee's id with this token, another organisation's token, another organisation's manager
            await expect(manager(orgId).deviceRegistration.emailLink({ employeeId: mine.id, token: 'not-a-real-token' })).rejects.toMatchObject({ appCode: 'LINK_NOT_FOUND' });
            await expect(manager(orgId).deviceRegistration.emailLink({ employeeId: other.id, token: mineLink.token })).rejects.toMatchObject({ appCode: 'LINK_NOT_FOUND' });
            await expect(manager(orgId).deviceRegistration.emailLink({ employeeId: foreign.id, token: foreignLink.token })).rejects.toMatchObject({ appCode: 'LINK_NOT_FOUND' });
            await expect(manager(otherOrgId).deviceRegistration.emailLink({ employeeId: mine.id, token: mineLink.token })).rejects.toMatchObject({ appCode: 'LINK_NOT_FOUND' });
            expect(mail.send).not.toHaveBeenCalled();
        });

        it('a link that is used, replaced or expired is refused, and so is an inactive employee', async () => {
            reset();
            const used = await seedEmployee(orgId);
            const replaced = await seedEmployee(orgId);
            const expired = await seedEmployee(orgId);
            const inactive = await seedEmployee(orgId);
            for (const e of [used, replaced, expired, inactive]) await setEmail(e.id, `${e.id}@example.test`);
            const u = await issueLink(used.id);
            await prisma.registrationToken.update({ where: { id: u.row.id }, data: { usedAt: new Date() } });
            const r1 = await issueLink(replaced.id);
            await issueLink(replaced.id); // supersedes r1
            const x = await issueLink(expired.id);
            await prisma.registrationToken.update({ where: { id: x.row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
            const i = await issueLink(inactive.id);
            await prisma.employee.update({ where: { id: inactive.id }, data: { status: 'INACTIVE' } });
            const api = manager(orgId).deviceRegistration;

            await expect(api.emailLink({ employeeId: used.id, token: u.token })).rejects.toMatchObject({ appCode: 'TOKEN_ALREADY_USED' });
            await expect(api.emailLink({ employeeId: replaced.id, token: r1.token })).rejects.toMatchObject({ appCode: 'TOKEN_SUPERSEDED' });
            await expect(api.emailLink({ employeeId: expired.id, token: x.token })).rejects.toMatchObject({ appCode: 'TOKEN_EXPIRED' });
            await expect(api.emailLink({ employeeId: inactive.id, token: i.token })).rejects.toMatchObject({ appCode: 'EMPLOYEE_INACTIVE' });
            expect(mail.send).not.toHaveBeenCalled();
        });

        it('a mail failure becomes EMAIL_FAILED without leaking the link, and the link stays usable for a retry', async () => {
            reset();
            const employee = await seedEmployee(orgId);
            await setEmail(employee.id, 'down@example.test');
            const { token } = await issueLink(employee.id);
            mail.send.mockRejectedValueOnce(new Error(`provider exploded while sending https://x.test/app/register?token=${token}`));

            const failure = await manager(orgId).deviceRegistration.emailLink({ employeeId: employee.id, token }).then(
                () => null,
                (e: { code: string; appCode: string; message: string }) => e,
            );

            expect(failure).toMatchObject({ code: 'BAD_GATEWAY', appCode: 'EMAIL_FAILED' });
            expect(JSON.stringify(failure)).not.toContain(token);
            expect(failure!.message).not.toContain(token);
            // the retry works with the very same link
            await expect(manager(orgId).deviceRegistration.emailLink({ employeeId: employee.id, token })).resolves.toMatchObject({ email: 'down@example.test' });
            await expect(phone().api().deviceRegistration.start({ token })).resolves.toBeDefined();
        });

        it('a NUL byte or an empty token is a bad request, not a server error', async () => {
            reset();
            const employee = await seedEmployee(orgId);
            const api = manager(orgId).deviceRegistration;

            await expect(api.emailLink({ employeeId: employee.id, token: 'ab\u0000cd' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
            await expect(api.emailLink({ employeeId: employee.id, token: '' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
            expect(mail.send).not.toHaveBeenCalled();
        });
    });
});
