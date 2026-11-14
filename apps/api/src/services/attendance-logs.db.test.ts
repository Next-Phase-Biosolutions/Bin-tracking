import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@bin-tracker/db';
import type { User, UserRole } from '@prisma/client';
import { appRouter } from '../routers/index.js';
import { cleanupOrg, dbTestsEnabled, seedCard, seedDevice, seedEmployee, seedOrg } from '../test-support/db.js';
import { attendanceLogsService } from './attendance-logs.service.js';
import { attendanceService } from './attendance.service.js';
import { payrollService } from './payroll.service.js';
import { tap } from './nfc-tap.service.js';

// The Attendance Logs queries on a real Postgres: which day a shift belongs to (company timezone, DST, midnight),
// distinct counts, tenant separation, both clock-in methods, and agreement with payroll. Skipped unless DATABASE_URL
// is a localhost *_test / *_ci database (see test-support/db.ts).
const suite = dbTestsEnabled() ? describe : describe.skip;

const NOW = new Date('2026-02-10T12:00:00Z');

suite('Attendance Logs (real Postgres)', () => {
    let orgId: string;
    let otherOrgId: string;
    const extra: string[] = [];

    beforeAll(async () => {
        orgId = (await seedOrg('logs')).id;
        otherOrgId = (await seedOrg('logs-other')).id;
    });
    afterAll(async () => {
        for (const id of [orgId, otherOrgId, ...extra]) await cleanupOrg(id);
    });

    /** A closed (or open, with outIso null) session for an employee, with times given in UTC. */
    async function session(employeeId: string, inIso: string, outIso: string | null, over: { autoClosed?: boolean; approvedAt?: Date | null; durationMin?: number | null } = {}) {
        const checkInAt = new Date(inIso);
        const checkOutAt = outIso ? new Date(outIso) : null;
        return prisma.workSession.create({
            data: {
                employeeId,
                checkInAt,
                checkOutAt,
                durationMin: over.durationMin !== undefined ? over.durationMin : checkOutAt ? Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60_000) : null,
                autoClosed: over.autoClosed ?? false,
                approvedAt: over.approvedAt ?? null,
            },
        });
    }
    const month = (year: number, m: number, org = orgId) => attendanceLogsService.month(org, { year, month: m }, NOW);
    const day = (date: string, org = orgId) => attendanceLogsService.day(org, { date }, NOW);
    const countOn = async (year: number, m: number, date: string, org = orgId) => (await month(year, m, org)).days.find((d) => d.date === date)?.employees ?? 0;

    describe('month: how many employees clocked in each day', () => {
        it('counts DIFFERENT employees per day: two shifts by one person count once', async () => {
            const a = await seedEmployee(orgId);
            const b = await seedEmployee(orgId);
            await session(a.id, '2026-04-06T13:00:00Z', '2026-04-06T17:00:00Z');
            await session(a.id, '2026-04-06T17:45:00Z', '2026-04-06T21:00:00Z');
            await session(b.id, '2026-04-06T14:00:00Z', '2026-04-06T22:00:00Z');
            await session(b.id, '2026-04-07T14:00:00Z', '2026-04-07T22:00:00Z');

            const m = await month(2026, 4);

            expect(m.days.find((d) => d.date === '2026-04-06')!.employees).toBe(2);
            expect(m.days.find((d) => d.date === '2026-04-07')!.employees).toBe(1);
            expect(m.days.find((d) => d.date === '2026-04-08')).toBeUndefined();
        });

        it('files a shift under the LOCAL day in the company timezone: 11:30 PM is that evening, 00:30 is the next day', async () => {
            const a = await seedEmployee(orgId);
            const b = await seedEmployee(orgId);
            await session(a.id, '2026-05-15T03:30:00Z', '2026-05-15T11:00:00Z'); // 23:30 EDT on 14 May (UTC-4)
            await session(b.id, '2026-05-15T04:30:00Z', '2026-05-15T12:00:00Z'); // 00:30 EDT on 15 May

            expect(await countOn(2026, 5, '2026-05-14')).toBe(1);
            expect(await countOn(2026, 5, '2026-05-15')).toBe(1);
        });

        it('splits months at local midnight: 23:59 on 31 January is January, 00:00 on 1 February is February', async () => {
            const a = await seedEmployee(orgId);
            const b = await seedEmployee(orgId);
            await session(a.id, '2026-02-01T04:59:00Z', '2026-02-01T10:00:00Z'); // 23:59 EST, 31 Jan
            await session(b.id, '2026-02-01T05:00:00Z', '2026-02-01T10:00:00Z'); // 00:00 EST, 1 Feb

            expect(await countOn(2026, 1, '2026-01-31')).toBe(1);
            expect(await countOn(2026, 2, '2026-01-31')).toBe(0);
            expect((await month(2026, 2)).days.find((d) => d.date === '2026-02-01')!.employees).toBe(1);
            expect((await month(2026, 1)).days.some((d) => d.date === '2026-02-01')).toBe(false);
        });

        it('December reaches its last local night, and January of the next year does not steal it', async () => {
            const a = await seedEmployee(orgId);
            await session(a.id, '2027-01-01T04:30:00Z', '2027-01-01T10:00:00Z'); // 23:30 EST on 31 Dec 2026

            expect(await countOn(2026, 12, '2026-12-31')).toBe(1);
            expect((await month(2027, 1)).days.some((d) => d.date === '2026-12-31')).toBe(false);
        });

        it('assigns the days clocks change (8 March and 1 November) to the right day', async () => {
            const a = await seedEmployee(orgId);
            const b = await seedEmployee(orgId);
            await session(a.id, '2026-03-08T06:30:00Z', '2026-03-08T14:00:00Z'); // 01:30 EST, just before the clocks go forward
            await session(b.id, '2026-11-01T05:30:00Z', '2026-11-01T14:00:00Z'); // 01:30 EDT, the hour that happens twice

            expect(await countOn(2026, 3, '2026-03-08')).toBe(1);
            expect(await countOn(2026, 11, '2026-11-01')).toBe(1);
            expect((await day('2026-03-08')).rows.some((r) => r.employeeId === a.id)).toBe(true);
            expect((await day('2026-11-01')).rows.some((r) => r.employeeId === b.id)).toBe(true);
        });

        it('uses the organization\'s own timezone: the same instant is a different day in Tokyo', async () => {
            const tokyo = (await seedOrg('logs-tokyo')).id;
            extra.push(tokyo);
            await prisma.settings.update({ where: { organizationId: tokyo }, data: { companyTimezone: 'Asia/Tokyo' } });
            const e = await seedEmployee(tokyo);
            await session(e.id, '2026-06-10T20:00:00Z', '2026-06-11T04:00:00Z'); // 05:00 on 11 June in Tokyo, 16:00 on 10 June in Toronto

            const m = await month(2026, 6, tokyo);

            expect(m.timezone).toBe('Asia/Tokyo');
            expect(m.days.map((d) => d.date)).toEqual(['2026-06-11']);
        });

        it('an organization with no settings row is treated as UTC (not an error)', async () => {
            const bare = await prisma.organization.create({ data: { name: 'No settings', slug: `logs-bare-${Date.now()}` } });
            extra.push(bare.id);
            await prisma.organizationModule.create({ data: { orgId: bare.id, module: 'WORKFORCE', enabled: true } });
            const e = await prisma.employee.create({ data: { organizationId: bare.id, employeeCode: 'B-1', fullName: 'Bare', qrCode: `Q-${Date.now()}` } });
            await session(e.id, '2026-06-10T23:30:00Z', '2026-06-11T05:00:00Z');

            const m = await month(2026, 6, bare.id);

            expect(m.timezone).toBe('UTC');
            expect(m.days.map((d) => d.date)).toEqual(['2026-06-10']);
        });

        it('reports today in the company timezone, and an empty month has no days', async () => {
            const m = await month(2031, 7);

            expect(m.days).toEqual([]);
            expect(m.today).toBe('2026-02-10');
            expect(m.timezone).toBe('America/Toronto');
        });

        it('never counts another organization\'s employees', async () => {
            const foreign = await seedEmployee(otherOrgId);
            await session(foreign.id, '2026-08-12T13:00:00Z', '2026-08-12T21:00:00Z');

            expect(await countOn(2026, 8, '2026-08-12')).toBe(0);
            expect(await countOn(2026, 8, '2026-08-12', otherOrgId)).toBe(1);
        });

        it('counts inactive employees on the days they worked', async () => {
            const gone = await seedEmployee(orgId, { status: 'INACTIVE' });
            await session(gone.id, '2026-09-09T13:00:00Z', '2026-09-09T21:00:00Z');

            expect(await countOn(2026, 9, '2026-09-09')).toBe(1);
        });
    });

    describe('day: who clocked in and out', () => {
        it('shows a person with two shifts as ONE row: first in, last out, and the SUMMED total (8h 18m, not 9h 03m)', async () => {
            const bob = await seedEmployee(orgId);
            await session(bob.id, '2026-10-14T11:58:00Z', '2026-10-14T16:02:00Z'); // 7:58 to 12:02 EDT
            await session(bob.id, '2026-10-14T16:47:00Z', '2026-10-14T21:01:00Z'); // 12:47 to 5:01 PM EDT

            const d = await day('2026-10-14');
            const row = d.rows.find((r) => r.employeeId === bob.id)!;

            expect(row.sessionCount).toBe(2);
            expect(row.firstIn).toEqual(new Date('2026-10-14T11:58:00Z'));
            expect(row.lastOut).toEqual(new Date('2026-10-14T21:01:00Z'));
            expect(row.totalMinutes).toBe(498);
            expect(row.breakMinutes).toBe(45);
            expect(row.sessions.map((s) => s.minutes)).toEqual([244, 254]);
        });

        it('an overnight shift stays on the day it started and is absent from the next day', async () => {
            const evan = await seedEmployee(orgId);
            await session(evan.id, '2026-10-16T02:05:00Z', '2026-10-16T10:10:00Z'); // 10:05 PM to 6:10 AM EDT, started on 15 Oct

            const start = (await day('2026-10-15')).rows.find((r) => r.employeeId === evan.id)!;
            const next = (await day('2026-10-16')).rows.find((r) => r.employeeId === evan.id);

            expect(start).toMatchObject({ totalMinutes: 485, lastOutDayOffset: 1 });
            expect(next).toBeUndefined();
        });

        it('still in, forgotten (overdue), auto-closed and approved are each reported correctly', async () => {
            const inNow = await seedEmployee(orgId);
            const overdue = await seedEmployee(orgId);
            const held = await seedEmployee(orgId);
            const approved = await seedEmployee(orgId);
            await session(inNow.id, '2026-02-10T09:00:00Z', null); // 3 h before NOW
            await session(overdue.id, '2026-02-09T12:00:00Z', null); // 24 h before NOW, never closed
            await session(held.id, '2026-02-09T13:00:00Z', '2026-02-10T05:00:00Z', { autoClosed: true, durationMin: 960 });
            await session(approved.id, '2026-02-09T13:30:00Z', '2026-02-10T05:30:00Z', { autoClosed: true, durationMin: 960, approvedAt: new Date('2026-02-10T08:00:00Z') });

            const today = await day('2026-02-10');
            const yesterday = await day('2026-02-09');
            const find = (d: typeof today, id: string) => d.rows.find((r) => r.employeeId === id)!;

            expect(find(today, inNow.id)).toMatchObject({ status: 'IN_PROGRESS', lastOut: null, totalMinutes: 0 });
            expect(find(yesterday, overdue.id)).toMatchObject({ status: 'OVERDUE', totalMinutes: 0 });
            expect(find(yesterday, held.id)).toMatchObject({ status: 'AUTO_CLOSED', totalMinutes: 0 });
            expect(find(yesterday, held.id).sessions[0]!.minutes).toBe(960);
            expect(find(yesterday, approved.id)).toMatchObject({ status: 'COMPLETE', totalMinutes: 960 });
            expect(yesterday.summary).toMatchObject({ awaitingApproval: 1, overdue: 1 });
        });

        it('never shows another organization\'s staff, even with the same employee code', async () => {
            const mine = await seedEmployee(orgId);
            const foreign = await seedEmployee(otherOrgId);
            await prisma.employee.update({ where: { id: foreign.id, organizationId: otherOrgId }, data: { employeeCode: mine.employeeCode.replace('T-', 'X-'), fullName: 'Foreign Person' } });
            await session(mine.id, '2026-10-20T13:00:00Z', '2026-10-20T21:00:00Z');
            await session(foreign.id, '2026-10-20T13:00:00Z', '2026-10-20T21:00:00Z');

            const d = await day('2026-10-20');

            expect(d.rows.some((r) => r.employeeId === foreign.id)).toBe(false);
            expect(d.rows.some((r) => r.fullName === 'Foreign Person')).toBe(false);
            expect((await day('2026-10-20', otherOrgId)).rows.some((r) => r.employeeId === foreign.id)).toBe(true);
        });

        it('a day nobody worked is an empty log', async () => {
            const d = await day('2026-12-25');

            expect(d.rows).toEqual([]);
            expect(d.summary.employees).toBe(0);
        });
    });

    describe('both clock-in methods write the same history', () => {
        it('sessions from NFC taps and from QR badge scans both appear', async () => {
            const org = (await seedOrg('logs-methods')).id;
            extra.push(org);
            const nfcPerson = await seedEmployee(org);
            const qrPerson = await seedEmployee(org);
            const { token } = await seedDevice(org, nfcPerson.id);
            const card = await seedCard(org, 'BOTH');

            // NFC (the default method): tap in and out on a past day
            await tap({ cardId: card.id, deviceToken: token }, new Date('2026-03-03T14:00:00Z'));
            await tap({ cardId: card.id, deviceToken: token }, new Date('2026-03-03T22:30:00Z'));
            // QR: only usable while the organization is on QR; the scan stamps "now" (today)
            await prisma.settings.update({ where: { organizationId: org }, data: { attendanceMethod: 'QR' } });
            await attendanceService.scan(org, { qrCode: qrPerson.qrCode });

            const past = await attendanceLogsService.day(org, { date: '2026-03-03' }, NOW);
            const todayStr = new Date().toISOString().slice(0, 10);
            const live = await attendanceLogsService.day(org, { date: todayStr }, new Date());

            expect(past.rows.find((r) => r.employeeId === nfcPerson.id)).toMatchObject({ status: 'COMPLETE', totalMinutes: 510 });
            expect(live.rows.some((r) => r.employeeId === qrPerson.id)).toBe(true);
        });
    });

    describe('agreement with payroll', () => {
        it('the day totals of a month add up to exactly the minutes payroll pays each person', async () => {
            const org = (await seedOrg('logs-payroll')).id;
            extra.push(org);
            const [a, b, c, d] = [await seedEmployee(org), await seedEmployee(org), await seedEmployee(org), await seedEmployee(org)];
            // a: plain shifts + a split day; b: month-end overnight; c: forgotten (unapproved) + approved one; d: late evening shift near midnight
            await session(a.id, '2026-04-06T13:00:00Z', '2026-04-06T21:00:00Z');
            await session(a.id, '2026-04-07T12:00:00Z', '2026-04-07T16:00:00Z');
            await session(a.id, '2026-04-07T16:45:00Z', '2026-04-07T21:00:00Z');
            await session(b.id, '2026-05-01T02:00:00Z', '2026-05-01T10:00:00Z'); // 10 PM 30 April to 6 AM 1 May local: April's pay and April's log
            await session(b.id, '2026-04-10T13:00:00Z', '2026-04-10T21:30:00Z');
            await session(c.id, '2026-04-12T13:00:00Z', '2026-04-13T05:00:00Z', { autoClosed: true, durationMin: 960 }); // held: neither pays nor counts
            await session(c.id, '2026-04-14T13:00:00Z', '2026-04-15T05:00:00Z', { autoClosed: true, durationMin: 960, approvedAt: new Date('2026-04-16T10:00:00Z') });
            await session(d.id, '2026-04-18T03:30:00Z', '2026-04-18T08:30:00Z'); // 11:30 PM local on 17 April

            await payrollService.computeRun(org, { period: '2026-04' });
            const run = await prisma.payrollRun.findUniqueOrThrow({ where: { organizationId_period: { organizationId: org, period: '2026-04' } }, include: { lineItems: true } });
            const paid = new Map(run.lineItems.map((l) => [l.employeeId, l.minutes]));

            const logged = new Map<string, number>();
            const m = await attendanceLogsService.month(org, { year: 2026, month: 4 }, NOW);
            for (const { date } of m.days) {
                for (const row of (await attendanceLogsService.day(org, { date }, NOW)).rows) logged.set(row.employeeId, (logged.get(row.employeeId) ?? 0) + row.totalMinutes);
            }

            for (const e of [a, b, c, d]) expect(logged.get(e.id) ?? 0, `employee ${e.fullName}`).toBe(paid.get(e.id) ?? 0);
            expect(paid.get(a.id)).toBe(480 + 240 + 255);
            expect(paid.get(c.id)).toBe(960); // only the approved forgotten shift
        });
    });

    describe('scale', () => {
        it('lists 300 people on one day correctly and quickly', async () => {
            const org = (await seedOrg('logs-crowd')).id;
            extra.push(org);
            const ids = Array.from({ length: 300 }, (_, i) => `crowd-${org}-${i}`);
            await prisma.employee.createMany({ data: ids.map((id, i) => ({ id, organizationId: org, employeeCode: `C-${i}`, fullName: `Crowd ${String(i).padStart(3, '0')}`, qrCode: `Q-${id}` })) });
            await prisma.workSession.createMany({ data: ids.map((id) => ({ employeeId: id, checkInAt: new Date('2026-07-07T13:00:00Z'), checkOutAt: new Date('2026-07-07T21:00:00Z'), durationMin: 480 })) });

            const t0 = Date.now();
            const d = await attendanceLogsService.day(org, { date: '2026-07-07' }, NOW);
            const m = await attendanceLogsService.month(org, { year: 2026, month: 7 }, NOW);

            expect(d.rows).toHaveLength(300);
            expect(d.summary.totalMinutes).toBe(300 * 480);
            expect(m.days).toEqual([{ date: '2026-07-07', employees: 300 }]);
            expect(Date.now() - t0).toBeLessThan(3000);
        });
    });

    describe('the router: input checks and access', () => {
        function caller(org: string, role: UserRole | null) {
            return appRouter.createCaller({
                prisma,
                user: role ? ({ id: `u-${org}`, role } as unknown as User) : null,
                orgId: org,
                orgRole: role,
                jwtPayload: null,
                req: { cookies: {}, headers: {}, ip: '10.4.4.4', log: { warn: () => undefined } },
            } as never);
        }

        it('rejects impossible dates and months as bad requests, not server errors', async () => {
            const api = caller(orgId, 'ADMIN').attendance;

            for (const date of ['2026-02-30', '2026-13-01', '2026-1-1', '', 'tomorrow', '2026-02-29', "2026-01-01'; DROP TABLE work_sessions;--"]) {
                await expect(api.logsDay({ date }), date).rejects.toMatchObject({ code: 'BAD_REQUEST' });
            }
            for (const input of [{ year: 2026, month: 13 }, { year: 2026, month: 0 }, { year: 1999, month: 1 }, { year: 2101, month: 1 }, { year: 2026.5, month: 1 }]) {
                await expect(api.logsMonth(input), JSON.stringify(input)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
            }
        });

        it('accepts a leap day', async () => {
            await expect(caller(orgId, 'ADMIN').attendance.logsDay({ date: '2028-02-29' })).resolves.toMatchObject({ rows: [] });
        });

        it('only admins and ops managers can read it, and only with the Workforce module on', async () => {
            vi.stubEnv('DISABLE_AUTH', 'false');
            try {
                for (const role of ['ADMIN', 'OPS_MANAGER'] as const) {
                    await expect(caller(orgId, role).attendance.logsDay({ date: '2026-12-25' })).resolves.toBeDefined();
                    await expect(caller(orgId, role).attendance.logsMonth({ year: 2026, month: 12 })).resolves.toBeDefined();
                }
                for (const role of ['DRIVER', 'WORKER'] as const) {
                    await expect(caller(orgId, role).attendance.logsDay({ date: '2026-12-25' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
                    await expect(caller(orgId, role).attendance.logsMonth({ year: 2026, month: 12 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
                }
                const off = (await seedOrg('logs-off', { workforce: false })).id;
                extra.push(off);
                await expect(caller(off, 'ADMIN').attendance.logsDay({ date: '2026-12-25' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
            } finally {
                vi.unstubAllEnvs();
            }
        });
    });
});
