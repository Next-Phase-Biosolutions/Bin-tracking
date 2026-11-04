import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@bin-tracker/db';
import { cleanupOrg, dbTestsEnabled, seedCard, seedDevice, seedEmployee, seedOrg } from '../test-support/db.js';
import { attendanceService } from './attendance.service.js';
import { payrollService } from './payroll.service.js';
import { tap } from './nfc-tap.service.js';

// NFC punches -> the EXISTING payroll, through its real SQL (the fakes in the other payroll
// tests cannot exercise the WHERE clauses). Skipped unless DATABASE_URL is a localhost
// *_test / *_ci database (see test-support/db.ts).
const suite = dbTestsEnabled() ? describe : describe.skip;

const hours = (h: number) => h * 3_600_000;
const RATE = 2000; // $20.00/h, the org flat rate from seedOrg

/** The payroll period ('YYYY-MM') a check-in falls in, in the org's company timezone. */
function periodOf(date: Date, timeZone = 'America/Toronto'): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
    return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}

suite('NFC attendance feeding payroll (real Postgres)', () => {
    let orgId: string;

    beforeAll(async () => {
        orgId = (await seedOrg('payroll')).id;
    });
    afterAll(async () => {
        await cleanupOrg(orgId);
    });

    async function person(hourlyRateCents: number | null = null) {
        const employee = await seedEmployee(orgId, { hourlyRateCents });
        const { token } = await seedDevice(orgId, employee.id);
        return { employee, token };
    }

    /** A check-in `startedAgo` before `now`, taken through the real NFC tap, then the check-out. */
    async function worked(token: string, cardId: string, checkIn: Date, minutes: number) {
        await tap({ cardId, deviceToken: token }, checkIn);
        await tap({ cardId, deviceToken: token }, new Date(checkIn.getTime() + minutes * 60_000));
    }

    const lineFor = async (period: string, employeeId: string) => {
        const run = await prisma.payrollRun.findUniqueOrThrow({ where: { organizationId_period: { organizationId: orgId, period } }, include: { lineItems: true, exceptions: true } });
        return { run, line: run.lineItems.find((l) => l.employeeId === employeeId), exceptions: run.exceptions.filter((e) => e.employeeId === employeeId) };
    };

    it('an NFC shift is paid at the right minutes and the org flat rate', async () => {
        const { employee, token } = await person();
        const card = await seedCard(orgId, 'BOTH');
        const checkIn = new Date(Date.now() - hours(30)); // recent but long closed
        await worked(token, card.id, checkIn, 8 * 60 + 30);

        await payrollService.computeRun(orgId, { period: periodOf(checkIn) });

        const { line, exceptions } = await lineFor(periodOf(checkIn), employee.id);
        expect(line).toMatchObject({ minutes: 510, rateCents: RATE, grossCents: Math.round((510 / 60) * RATE) });
        expect(exceptions).toHaveLength(0);
    });

    it("the employee's own rate wins over the org flat rate", async () => {
        const { employee, token } = await person(3000);
        const card = await seedCard(orgId, 'BOTH');
        const checkIn = new Date(Date.now() - hours(40));
        await worked(token, card.id, checkIn, 120);

        await payrollService.computeRun(orgId, { period: periodOf(checkIn) });

        expect((await lineFor(periodOf(checkIn), employee.id)).line).toMatchObject({ minutes: 120, rateCents: 3000, grossCents: 6000 });
    });

    it('a forgotten check-out is NOT paid: it is auto-closed lazily and held as an AUTO_CLOSED exception', async () => {
        const { employee, token } = await person();
        const card = await seedCard(orgId, 'BOTH');
        const checkIn = new Date(Date.now() - hours(20));
        await tap({ cardId: card.id, deviceToken: token }, checkIn); // checks in; nobody ever taps out

        await payrollService.computeRun(orgId, { period: periodOf(checkIn) });

        const { line, exceptions } = await lineFor(periodOf(checkIn), employee.id);
        expect(line).toBeUndefined(); // nothing paid
        expect(exceptions).toMatchObject([{ type: 'AUTO_CLOSED', resolved: false }]); // not NO_CHECKOUT: it was closed at the cap
        expect(await prisma.workSession.findFirstOrThrow({ where: { employeeId: employee.id } })).toMatchObject({ autoClosed: true, durationMin: 960, approvedAt: null });
    });

    it('a shift still in progress (under 16 h) is a NO_CHECKOUT exception, not closed and not paid', async () => {
        const { employee, token } = await person();
        const card = await seedCard(orgId, 'BOTH');
        const checkIn = new Date(Date.now() - hours(2));
        await tap({ cardId: card.id, deviceToken: token }, checkIn);

        await payrollService.computeRun(orgId, { period: periodOf(checkIn) });

        const { line, exceptions } = await lineFor(periodOf(checkIn), employee.id);
        expect(line).toBeUndefined();
        expect(exceptions).toMatchObject([{ type: 'NO_CHECKOUT' }]);
        expect((await prisma.workSession.findFirstOrThrow({ where: { employeeId: employee.id } })).checkOutAt).toBeNull();
    });

    it('once a manager approves the auto-closed shift and payroll is recomputed, it is paid and the exception is gone', async () => {
        const { employee, token } = await person();
        const card = await seedCard(orgId, 'BOTH');
        const checkIn = new Date(Date.now() - hours(22));
        await tap({ cardId: card.id, deviceToken: token }, checkIn);
        const period = periodOf(checkIn);
        await payrollService.computeRun(orgId, { period });
        expect((await lineFor(period, employee.id)).exceptions).toHaveLength(1);

        const [pending] = (await attendanceService.listPendingApprovals(orgId)).filter((p) => p.employee.id === employee.id);
        await attendanceService.approveWorkSession(orgId, null, { id: pending!.id });
        await payrollService.computeRun(orgId, { period });

        const { line, exceptions } = await lineFor(period, employee.id);
        expect(line).toMatchObject({ minutes: 960, grossCents: Math.round((960 / 60) * RATE) });
        expect(exceptions).toHaveLength(0);
    });

    it('approving with a real, longer check-out pays exactly that time', async () => {
        const { employee, token } = await person();
        const card = await seedCard(orgId, 'BOTH');
        const checkIn = new Date(Date.now() - hours(28));
        await tap({ cardId: card.id, deviceToken: token }, checkIn);
        const period = periodOf(checkIn);
        await payrollService.computeRun(orgId, { period }); // lazily auto-closes it

        const [pending] = (await attendanceService.listPendingApprovals(orgId)).filter((p) => p.employee.id === employee.id);
        await attendanceService.approveWorkSession(orgId, null, { id: pending!.id, checkOutAt: new Date(checkIn.getTime() + hours(19)).toISOString() });
        await payrollService.computeRun(orgId, { period });

        expect((await lineFor(period, employee.id)).line).toMatchObject({ minutes: 19 * 60 });
    });

    it('does not close or pay another organization\'s forgotten shifts when this one runs payroll', async () => {
        const otherOrg = (await seedOrg('payroll-other')).id;
        try {
            const foreign = await seedEmployee(otherOrg);
            await prisma.workSession.create({ data: { employeeId: foreign.id, checkInAt: new Date(Date.now() - hours(25)) } });
            const mine = await person();
            const card = await seedCard(orgId, 'BOTH');
            const checkIn = new Date(Date.now() - hours(50));
            await worked(mine.token, card.id, checkIn, 60);

            await payrollService.computeRun(orgId, { period: periodOf(checkIn) });

            expect(await prisma.workSession.findFirstOrThrow({ where: { employeeId: foreign.id } })).toMatchObject({ checkOutAt: null, autoClosed: false });
        } finally {
            await cleanupOrg(otherOrg);
        }
    });

    it('FIX_CHECKOUT refuses a check-out that runs into the next shift, against real rows', async () => {
        const { employee } = await person();
        const firstIn = new Date(Date.now() - hours(60));
        const nextIn = new Date(firstIn.getTime() + hours(6));
        const first = await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: firstIn } }); // NO_CHECKOUT
        await prisma.workSession.create({ data: { employeeId: employee.id, checkInAt: nextIn, checkOutAt: new Date(nextIn.getTime() + hours(2)), durationMin: 120 } });
        const period = periodOf(firstIn);
        await payrollService.computeRun(orgId, { period });
        const { exceptions } = await lineFor(period, employee.id);
        const exception = exceptions.find((e) => e.sessionId === first.id)!;

        await expect(
            payrollService.resolveException(orgId, { exceptionId: exception.id, action: 'FIX_CHECKOUT', checkOutAt: new Date(nextIn.getTime() + 60_000).toISOString() }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringContaining('next shift') });
        await expect(
            payrollService.resolveException(orgId, { exceptionId: exception.id, action: 'FIX_CHECKOUT', checkOutAt: nextIn.toISOString() }),
        ).resolves.toMatchObject({ resolved: true, requiresRecompute: true });
    });
});
