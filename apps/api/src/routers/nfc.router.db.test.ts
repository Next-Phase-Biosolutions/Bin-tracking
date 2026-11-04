import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@bin-tracker/db';
import type { User, UserRole } from '@prisma/client';
import { appRouter } from './index.js';
import { hashToken } from '../lib/token.js';
import { cleanupOrg, dbTestsEnabled, seedCard, seedDevice, seedEmployee, seedOrg } from '../test-support/db.js';

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
        it('sets only the short-lived pending cookie, with strict attributes', async () => {
            const employee = await seedEmployee(orgId);
            const { token } = await issueLink(employee.id);
            const browser = phone();

            await browser.api().deviceRegistration.start({ token });

            expect(browser.set).toHaveLength(1);
            expect(browser.set[0]).toMatchObject({
                name: 'bt_pending_reg',
                value: hashToken(token),
                options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 },
            });
            expect(browser.jar.has('bt_device')).toBe(false);
            expect(await prisma.deviceSession.count({ where: { employeeId: employee.id } })).toBe(0);
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

        it('throttles guessing: the 21st attempt from one IP in an hour is TOO_MANY_REQUESTS', async () => {
            const browser = phone();
            const attempts = [];
            for (let i = 0; i < 22; i++) attempts.push(await browser.api().deviceRegistration.start({ token: `guess-${i}` }).catch((e: { code: string }) => e.code));
            expect(attempts.slice(0, 20).every((c) => c === 'NOT_FOUND')).toBe(true);
            expect(attempts.slice(20)).toEqual(['TOO_MANY_REQUESTS', 'TOO_MANY_REQUESTS']);
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

            await expect(browser.api().attendance.tap({ cardId: dead.id })).rejects.toMatchObject({ appCode: 'CARD_INACTIVE' });
            await expect(browser.api().attendance.tap({ cardId: 'no-such-card' })).rejects.toMatchObject({ appCode: 'CARD_NOT_FOUND' });

            expect(browser.jar.get('bt_pending_reg')).toBe(hashToken(token));
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
            await first.api().attendance.tap({ cardId: card.id });

            const thief = phone();
            thief.jar.set('bt_pending_reg', hashToken(token));
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
            for (const forged of ['\u0000', 'x'.repeat(64), 'A'.repeat(64), '%00', "' OR 1=1 --", 'a'.repeat(5000)]) {
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
});
