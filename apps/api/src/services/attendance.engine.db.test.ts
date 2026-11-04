import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@bin-tracker/db';
import { cleanupOrg, dbTestsEnabled, seedCard, seedCrowd, seedDevice, seedEmployee, seedOrg } from '../test-support/db.js';
import { attendanceService } from './attendance.service.js';
import { tap } from './nfc-tap.service.js';

// Real-Postgres suite for the shared punch engine. Skipped unless DATABASE_URL is
// a localhost *_test / *_ci database (see test-support/db.ts).
const suite = dbTestsEnabled() ? describe : describe.skip;

const T0 = new Date('2031-03-03T09:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const hours = (h: number) => h * 3_600_000;

suite('attendance engine (real Postgres)', () => {
    let orgId: string;
    let otherOrgId: string;

    beforeAll(async () => {
        orgId = (await seedOrg('engine')).id;
        otherOrgId = (await seedOrg('engine-other')).id;
    });
    afterAll(async () => {
        await cleanupOrg(orgId);
        await cleanupOrg(otherOrgId);
    });

    /** A fresh employee + registered phone, so tests never share shift state. */
    async function person(org = orgId) {
        const employee = await seedEmployee(org);
        const { token } = await seedDevice(org, employee.id);
        return { employee, token };
    }
    const punch = (cardId: string, token: string, now: Date) => tap({ cardId, deviceToken: token }, now);
    const events = (employeeId: string) => prisma.attendanceEvent.findMany({ where: { employeeId }, orderBy: { scannedAt: 'asc' } });
    const sessions = (employeeId: string) => prisma.workSession.findMany({ where: { employeeId }, orderBy: { checkInAt: 'asc' } });

    describe('strict IN / OUT cards', () => {
        it('IN opens a shift, OUT closes it with the right duration', async () => {
            const { employee, token } = await person();
            const inCard = await seedCard(orgId, 'IN');
            const outCard = await seedCard(orgId, 'OUT');

            const checkIn = await punch(inCard.id, token, at(0));
            const checkOut = await punch(outCard.id, token, at(8 * 3600 + 9 * 60));

            expect(checkIn.result).toMatchObject({ status: 'CHECK_IN', debounced: false, employeeName: employee.fullName });
            expect(checkOut.result).toMatchObject({ status: 'CHECK_OUT', durationMin: 489, debounced: false });
            const [session] = await sessions(employee.id);
            expect(session).toMatchObject({ durationMin: 489, autoClosed: false, approvedAt: null });
            expect((await events(employee.id)).map((e) => e.eventType)).toEqual(['CHECK_IN', 'CHECK_OUT']);
        });

        it('an IN card while already in changes nothing and is audited as REJECTED', async () => {
            const { employee, token } = await person();
            const inCard = await seedCard(orgId, 'IN');

            await punch(inCard.id, token, at(0));
            const again = await punch(inCard.id, token, at(60));

            expect(again.result).toMatchObject({ status: 'ALREADY_CHECKED_IN', debounced: false });
            expect(await sessions(employee.id)).toHaveLength(1);
            expect((await events(employee.id)).map((e) => e.eventType)).toEqual(['CHECK_IN', 'REJECTED']);
        });

        it('an OUT card while out is a 200-style result with a REJECTED row that has no session', async () => {
            const { employee, token } = await person();
            const outCard = await seedCard(orgId, 'OUT');

            const result = await punch(outCard.id, token, at(0));

            expect(result.result.status).toBe('NOT_CHECKED_IN');
            expect(await sessions(employee.id)).toHaveLength(0);
            const [rejected] = await events(employee.id);
            expect(rejected).toMatchObject({ eventType: 'REJECTED', sessionId: null, source: 'nfc' });
        });
    });

    describe('BOTH (toggle) card', () => {
        it('alternates in, out, in, out and never rejects', async () => {
            const { employee, token } = await person();
            const both = await seedCard(orgId, 'BOTH');

            const results = [];
            for (let i = 0; i < 4; i++) results.push((await punch(both.id, token, at(i * 3600))).result.status);

            expect(results).toEqual(['CHECK_IN', 'CHECK_OUT', 'CHECK_IN', 'CHECK_OUT']);
            expect((await events(employee.id)).filter((e) => e.eventType === 'REJECTED')).toHaveLength(0);
            expect(await sessions(employee.id)).toHaveLength(2);
        });

        it('mixed IN / BOTH / OUT cards stay consistent and IN / OUT stay strict', async () => {
            const { token } = await person();
            const [inCard, outCard, both] = [await seedCard(orgId, 'IN'), await seedCard(orgId, 'OUT'), await seedCard(orgId, 'BOTH')];

            expect((await punch(both.id, token, at(0))).result.status).toBe('CHECK_IN');
            expect((await punch(inCard.id, token, at(600))).result.status).toBe('ALREADY_CHECKED_IN');
            expect((await punch(outCard.id, token, at(1200))).result.status).toBe('CHECK_OUT');
            expect((await punch(outCard.id, token, at(1800))).result.status).toBe('NOT_CHECKED_IN');
        });
    });

    describe('debounce', () => {
        it('a second tap inside 5 s echoes the first result and is audited as DEBOUNCED', async () => {
            const { employee, token } = await person();
            const both = await seedCard(orgId, 'BOTH');

            const first = await punch(both.id, token, at(0));
            const echo = await punch(both.id, token, at(2));

            expect(echo.result).toMatchObject({ status: 'CHECK_IN', debounced: true });
            expect(echo.result.at.getTime()).toBe(first.result.at.getTime());
            expect(await sessions(employee.id)).toHaveLength(1);
            expect((await events(employee.id)).map((e) => e.eventType)).toEqual(['CHECK_IN', 'DEBOUNCED']);
        });

        it('is anchored on the last REAL tap, and exactly 5 s later is a real tap', async () => {
            const { token } = await person();
            const both = await seedCard(orgId, 'BOTH');

            await punch(both.id, token, at(0)); // real
            await punch(both.id, token, at(3)); // echo: must NOT extend the window
            const real = await punch(both.id, token, at(5)); // 5 s after the REAL tap

            expect(real.result).toMatchObject({ status: 'CHECK_OUT', debounced: false });
        });

        it('echoes a check-out together with its duration', async () => {
            const { token } = await person();
            const both = await seedCard(orgId, 'BOTH');
            await punch(both.id, token, at(0));
            await punch(both.id, token, at(3600));

            const echo = await punch(both.id, token, at(3602));

            expect(echo.result).toMatchObject({ status: 'CHECK_OUT', durationMin: 60, debounced: true });
        });

        it('echoes a rejection while the state is unchanged', async () => {
            const { token } = await person();
            const outCard = await seedCard(orgId, 'OUT');
            await punch(outCard.id, token, at(0));

            const echo = await punch(outCard.id, token, at(2));

            expect(echo.result).toMatchObject({ status: 'NOT_CHECKED_IN', debounced: true });
        });
    });

    describe('lazy auto-close of forgotten check-outs', () => {
        it('a shift open 17 h is closed at the 16 h cap, flagged and unapproved, then the tap starts a fresh shift', async () => {
            const { employee, token } = await person();
            const both = await seedCard(orgId, 'BOTH');
            const old = await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: new Date(T0.getTime() - hours(17)) } });

            const result = await punch(both.id, token, T0);

            const closed = await prisma.workSession.findUniqueOrThrow({ where: { id: old.id } });
            expect(closed).toMatchObject({ durationMin: 960, autoClosed: true, approvedAt: null });
            expect(closed.checkOutAt?.getTime()).toBe(old.checkInAt.getTime() + hours(16));
            expect(result.result.status).toBe('CHECK_IN');
            expect((await sessions(employee.id)).filter((s) => s.checkOutAt === null)).toHaveLength(1);
        });

        it('a shift open 15 h is left alone and checked out normally', async () => {
            const { employee, token } = await person();
            const both = await seedCard(orgId, 'BOTH');
            await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: new Date(T0.getTime() - hours(15)) } });

            const result = await punch(both.id, token, T0);

            expect(result.result).toMatchObject({ status: 'CHECK_OUT', durationMin: 900 });
            expect((await sessions(employee.id))[0]).toMatchObject({ autoClosed: false });
        });

        it('exactly 16 h is stale (boundary), 15 h 59 m 59 s is not', async () => {
            const a = await person();
            const b = await person();
            const outCard = await seedCard(orgId, 'OUT');
            await prisma.workSession.create({ data: { employeeId: a.employee.id, checkInAt: new Date(T0.getTime() - hours(16)) } });
            await prisma.workSession.create({ data: { employeeId: b.employee.id, checkInAt: new Date(T0.getTime() - hours(16) + 1000) } });

            const atCap = await punch(outCard.id, a.token, T0);
            const underCap = await punch(outCard.id, b.token, T0);

            // exactly 16 h: auto-closed first, so there is nothing left for the OUT card to close
            expect(atCap.result.status).toBe('NOT_CHECKED_IN');
            expect((await sessions(a.employee.id))[0]).toMatchObject({ autoClosed: true, durationMin: 960 });
            // 1 s under: a normal, paid check-out
            expect(underCap.result).toMatchObject({ status: 'CHECK_OUT', durationMin: 960 });
            expect((await sessions(b.employee.id))[0]).toMatchObject({ autoClosed: false });
        });

        it('closeStaleSessions closes only THIS organization\'s forgotten shifts', async () => {
            const mine = await seedEmployee(orgId);
            const theirs = await seedEmployee(otherOrgId);
            const stale = new Date(Date.now() - hours(20));
            await prisma.workSession.create({ data: { employeeId: mine.id, checkInAt: stale } });
            await prisma.workSession.create({ data: { employeeId: theirs.id, checkInAt: stale } });

            const { closed } = await attendanceService.closeStaleSessions(orgId);

            expect(closed).toBeGreaterThanOrEqual(1);
            expect((await sessions(mine.id))[0]).toMatchObject({ autoClosed: true });
            expect((await sessions(theirs.id))[0]).toMatchObject({ autoClosed: false, checkOutAt: null });
        });
    });

    describe('concurrency', () => {
        it('the database refuses a second open shift for one employee (partial unique index)', async () => {
            const employee = await seedEmployee(orgId);
            await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: T0 } });

            await expect(prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: at(60) } })).rejects.toMatchObject({ code: 'P2002' });

            // a CLOSED session beside an open one is fine
            await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: at(-7200), checkOutAt: at(-3600), durationMin: 60 } });
        });

        it('four racing taps for one employee yield exactly one real check-in and one shift', async () => {
            const { employee, token } = await person();
            const both = await seedCard(orgId, 'BOTH');

            const results = await Promise.all([0, 1, 2, 3].map(() => punch(both.id, token, T0)));

            expect(results.every((r) => r.result.status === 'CHECK_IN')).toBe(true);
            expect(results.filter((r) => !r.result.debounced)).toHaveLength(1);
            expect(await sessions(employee.id)).toHaveLength(1);
        });

        it('racing IN and OUT cards at the same instant never leave two open shifts or overlap', async () => {
            const { employee, token } = await person();
            const inCard = await seedCard(orgId, 'IN');
            const outCard = await seedCard(orgId, 'OUT');

            await Promise.all([punch(inCard.id, token, T0), punch(outCard.id, token, T0), punch(inCard.id, token, T0)]);

            expect((await sessions(employee.id)).filter((s) => s.checkOutAt === null).length).toBeLessThanOrEqual(1);
        });

        it('different employees tapping at once do not interfere', async () => {
            const [a, b] = [await person(), await person()];
            const both = await seedCard(orgId, 'BOTH');

            const [ra, rb] = await Promise.all([punch(both.id, a.token, T0), punch(both.id, b.token, T0)]);

            expect([ra.result.status, rb.result.status]).toEqual(['CHECK_IN', 'CHECK_IN']);
        });

        it('a 300-phone rush at shift start succeeds for everyone, then everyone checks out', async () => {
            const crowd = await seedCrowd(orgId, 300);
            const both = await seedCard(orgId, 'BOTH');
            const ids = crowd.map((c) => c.employeeId);

            const wave1 = await Promise.allSettled(crowd.map((c) => punch(both.id, c.token, T0)));
            expect(wave1.filter((r) => r.status === 'rejected')).toHaveLength(0);
            expect(wave1.every((r) => r.status === 'fulfilled' && r.value.result.status === 'CHECK_IN' && !r.value.result.debounced)).toBe(true);
            expect(await prisma.workSession.count({ where: { employeeId: { in: ids }, checkOutAt: null } })).toBe(300);

            const wave2 = await Promise.allSettled(crowd.map((c) => punch(both.id, c.token, new Date(T0.getTime() + hours(8)))));
            expect(wave2.filter((r) => r.status === 'rejected')).toHaveLength(0);
            expect(wave2.every((r) => r.status === 'fulfilled' && r.value.result.status === 'CHECK_OUT')).toBe(true);
            expect(await prisma.workSession.count({ where: { employeeId: { in: ids }, checkOutAt: null } })).toBe(0);
            expect(await prisma.workSession.count({ where: { employeeId: { in: ids }, durationMin: 480 } })).toBe(300);
        }, 120_000);

        it('a double-tap storm (4 simultaneous taps x 120 employees) opens exactly 120 shifts', async () => {
            const crowd = await seedCrowd(orgId, 120);
            const both = await seedCard(orgId, 'BOTH');

            const results = await Promise.all(crowd.flatMap((c) => [0, 1, 2, 3].map(() => punch(both.id, c.token, T0))));

            expect(results.filter((r) => !r.result.debounced)).toHaveLength(120);
            expect(await prisma.workSession.count({ where: { employeeId: { in: crowd.map((c) => c.employeeId) } } })).toBe(120);
        }, 120_000);
    });

    describe('QR scan shares the same engine', () => {
        it('scan checks in, debounces, and checks out through the lock', async () => {
            const employee = await seedEmployee(orgId);

            const first = await attendanceService.scan(orgId, { qrCode: employee.qrCode });
            const echo = await attendanceService.scan(orgId, { qrCode: employee.qrCode });

            expect(first).toMatchObject({ action: 'CHECK_IN', debounced: false, employeeName: employee.fullName });
            expect(echo).toMatchObject({ action: 'CHECK_IN', debounced: true });
            expect(await sessions(employee.id)).toHaveLength(1);
        });

        it('four racing scans open one shift', async () => {
            const employee = await seedEmployee(orgId);

            await Promise.all([0, 1, 2, 3].map(() => attendanceService.scan(orgId, { qrCode: employee.qrCode })));

            expect(await sessions(employee.id)).toHaveLength(1);
        });

        it('a badge from another organization does not resolve', async () => {
            const foreign = await seedEmployee(otherOrgId);
            await expect(attendanceService.scan(orgId, { qrCode: foreign.qrCode })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('approval of auto-closed sessions', () => {
        /** An auto-closed, unapproved session that checked in 20 h before `anchor`. */
        async function autoClosed(anchor = T0) {
            const employee = await seedEmployee(orgId);
            const checkInAt = new Date(anchor.getTime() - hours(20));
            const session = await prisma.workSession.create({
                data: { employeeId: employee.id, checkInAt, checkOutAt: new Date(checkInAt.getTime() + hours(16)), durationMin: 960, autoClosed: true },
            });
            return { employee, session, checkInAt };
        }

        it('lists only auto-closed, unapproved sessions of this organization', async () => {
            const { session } = await autoClosed();
            const foreignEmployee = await seedEmployee(otherOrgId);
            await prisma.workSession.create({
                data: { employeeId: foreignEmployee.id, checkInAt: T0, checkOutAt: at(100), durationMin: 2, autoClosed: true },
            });

            const pending = await attendanceService.listPendingApprovals(orgId);

            expect(pending.map((p) => p.id)).toContain(session.id);
            expect(pending.every((p) => p.employee.id !== foreignEmployee.id)).toBe(true);
        });

        it('approving as-is keeps the capped 16 h and stamps approvedAt', async () => {
            const { session } = await autoClosed();

            const approved = await attendanceService.approveWorkSession(orgId, null, { id: session.id }, T0);

            expect(approved).toMatchObject({ durationMin: 960 });
            expect(approved.approvedAt?.getTime()).toBe(T0.getTime());
            expect((await attendanceService.listPendingApprovals(orgId)).map((p) => p.id)).not.toContain(session.id);
        });

        it('approving with a real, later check-out uses that time (genuine overtime)', async () => {
            const { session, checkInAt } = await autoClosed();
            const realCheckOut = new Date(checkInAt.getTime() + hours(19));

            const approved = await attendanceService.approveWorkSession(orgId, null, { id: session.id, checkOutAt: realCheckOut.toISOString() }, T0);

            expect(approved.durationMin).toBe(19 * 60);
        });

        it('writes an audit row when an actor is known', async () => {
            const { session } = await autoClosed();
            const actorId = `actor-${session.id}`;

            await attendanceService.approveWorkSession(orgId, actorId, { id: session.id }, T0);

            const log = await prisma.payrollAuditLog.findFirst({ where: { orgId, actorId } });
            expect(log).toMatchObject({ action: 'attendance.approveSession', targetId: session.id });
        });

        it('refuses a session that was never auto-closed, one already approved, and bad times', async () => {
            const { session, checkInAt } = await autoClosed();
            const plain = await seedEmployee(orgId);
            const normal = await prisma.workSession.create({
                data: { employeeId: plain.id, checkInAt: at(-7200), checkOutAt: at(-3600), durationMin: 60 },
            });

            await expect(attendanceService.approveWorkSession(orgId, null, { id: normal.id }, T0)).rejects.toMatchObject({ appCode: 'NOT_AUTO_CLOSED' });
            await expect(
                attendanceService.approveWorkSession(orgId, null, { id: session.id, checkOutAt: checkInAt.toISOString() }, T0),
            ).rejects.toMatchObject({ appCode: 'INVALID_CHECK_OUT' });
            await expect(
                attendanceService.approveWorkSession(orgId, null, { id: session.id, checkOutAt: at(3600).toISOString() }, T0),
            ).rejects.toMatchObject({ appCode: 'INVALID_CHECK_OUT' }); // in the future

            await attendanceService.approveWorkSession(orgId, null, { id: session.id }, T0);
            await expect(attendanceService.approveWorkSession(orgId, null, { id: session.id }, T0)).rejects.toMatchObject({ appCode: 'ALREADY_APPROVED' });
        });

        it('refuses an approval whose check-out overlaps the next shift, allows ending exactly when it starts', async () => {
            const { employee, session, checkInAt } = await autoClosed();
            const nextStart = new Date(checkInAt.getTime() + hours(18));
            await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: nextStart } }); // still open

            await expect(
                attendanceService.approveWorkSession(orgId, null, { id: session.id, checkOutAt: new Date(nextStart.getTime() + 60_000).toISOString() }, T0),
            ).rejects.toMatchObject({ appCode: 'OVERLAPS_NEXT_SESSION' });
            expect((await prisma.workSession.findUniqueOrThrow({ where: { id: session.id } })).approvedAt).toBeNull();

            const ok = await attendanceService.approveWorkSession(orgId, null, { id: session.id, checkOutAt: nextStart.toISOString() }, T0);
            expect(ok.durationMin).toBe(18 * 60);
        });

        it("another organization's session is indistinguishable from a missing one", async () => {
            const foreignEmployee = await seedEmployee(otherOrgId);
            const foreign = await prisma.workSession.create({
                data: { employeeId: foreignEmployee.id, checkInAt: at(-90000), checkOutAt: at(-30000), durationMin: 960, autoClosed: true },
            });

            await expect(attendanceService.approveWorkSession(orgId, null, { id: foreign.id }, T0)).rejects.toMatchObject({ appCode: 'WORK_SESSION_NOT_FOUND' });
            await expect(attendanceService.approveWorkSession(orgId, null, { id: 'does-not-exist' }, T0)).rejects.toMatchObject({ appCode: 'WORK_SESSION_NOT_FOUND' });
            expect((await prisma.workSession.findUniqueOrThrow({ where: { id: foreign.id } })).approvedAt).toBeNull();
        });
    });

    describe('facilityStatus', () => {
        it('puts every active employee in exactly one bucket, counts unregistered phones, and never mutates', async () => {
            const org = (await seedOrg('status')).id;
            try {
                const present = await seedEmployee(org);
                const forgot = await seedEmployee(org);
                const gone = await seedEmployee(org);
                const inactive = await seedEmployee(org, { status: 'INACTIVE' });
                await seedDevice(org, present.id); // only `present` has a phone
                const now = new Date('2031-06-01T12:00:00.000Z');
                await prisma.workSession.create({ data: { employeeId: present.id, checkInAt: new Date(now.getTime() - hours(3)) } });
                await prisma.workSession.create({ data: { employeeId: forgot.id, checkInAt: new Date(now.getTime() - hours(16)) } });
                const lastOut = new Date(now.getTime() - hours(30));
                await prisma.workSession.create({ data: { employeeId: gone.id, checkInAt: new Date(lastOut.getTime() - hours(8)), checkOutAt: lastOut, durationMin: 480 } });
                await prisma.workSession.create({ data: { employeeId: inactive.id, checkInAt: new Date(now.getTime() - hours(1)) } });

                const status = await attendanceService.facilityStatus(org, now);

                expect(status.checkedIn.map((e) => e.employeeId)).toEqual([present.id]);
                expect(status.overdue.map((e) => e.employeeId)).toEqual([forgot.id]); // exactly 16 h counts as overdue
                expect(status.checkedOut.map((e) => e.employeeId)).toEqual([gone.id]);
                expect(status.checkedOut[0]?.lastCheckOutAt?.getTime()).toBe(lastOut.getTime());
                expect(status.totals).toMatchObject({ employees: 4, active: 3, inactive: 1, checkedIn: 1, overdue: 1, checkedOut: 1, unregistered: 2 });
                // read-only: the forgotten shift was NOT auto-closed, and no event was written
                expect((await prisma.workSession.findFirstOrThrow({ where: { employeeId: forgot.id } })).checkOutAt).toBeNull();
                expect(await prisma.attendanceEvent.count({ where: { employee: { organizationId: org } } })).toBe(0);
            } finally {
                await cleanupOrg(org);
            }
        });

        it('exposes no pay rate and no QR code, and sees nothing from another organization', async () => {
            const org = (await seedOrg('status-leak')).id;
            try {
                const rich = await seedEmployee(org, { hourlyRateCents: 9999 });
                await seedEmployee(otherOrgId);

                const status = await attendanceService.facilityStatus(org);

                const everyone = [...status.checkedIn, ...status.overdue, ...status.checkedOut];
                expect(everyone.map((e) => e.employeeId)).toEqual([rich.id]);
                const serialized = JSON.stringify(status);
                expect(serialized).not.toContain('9999');
                expect(serialized).not.toContain('hourlyRateCents');
                expect(serialized).not.toContain(rich.qrCode);
                expect(Object.keys(everyone[0] ?? {}).sort()).toEqual(['employeeCode', 'employeeId', 'fullName', 'lastCheckOutAt']);
            } finally {
                await cleanupOrg(org);
            }
        });
    });
});
