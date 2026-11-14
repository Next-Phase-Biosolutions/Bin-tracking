import { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import type { AttendanceLogsDayInput, AttendanceLogsMonthInput } from '@bin-tracker/validators';
import { buildDayLog, type LogSessionRow } from '../lib/attendance-day-log.js';
import { localDateOf } from '../lib/period.js';

/**
 * Read-only history for the Attendance Logs page. A shift is filed under the day the employee CLOCKED IN, in the
 * company's timezone, using the same Postgres conversion payroll uses (DST-correct, done in the database), so a day
 * here and a month in payroll always agree about which shifts belong to them. Every query joins the employee to
 * restrict to one organization: work_sessions has no organizationId column of its own.
 */

/** The organization's IANA timezone (payroll's setting). An organization with no settings row is treated as UTC. */
async function companyTimezone(orgId: string): Promise<string> {
    const settings = await prisma.settings.findUnique({ where: { organizationId: orgId }, select: { companyTimezone: true } });
    return settings?.companyTimezone ?? 'UTC';
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export const attendanceLogsService = {
    /** Per day of one month: how many different employees clocked in. Days with no clock-ins are simply absent. */
    async month(orgId: string, input: AttendanceLogsMonthInput, now: Date = new Date()) {
        const tz = await companyTimezone(orgId);
        const { year, month } = input;
        const start = `${pad(year, 4)}-${pad(month)}-01 00:00:00`;
        const end = month === 12 ? `${pad(year + 1, 4)}-01-01 00:00:00` : `${pad(year, 4)}-${pad(month + 1)}-01 00:00:00`;

        const rows = await prisma.$queryRaw<Array<{ day: string; employees: number }>>(
            Prisma.sql`
                SELECT to_char((ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS day,
                       COUNT(DISTINCT ws."employeeId")::int AS employees
                FROM "work_sessions" ws
                JOIN "employees" e ON e."id" = ws."employeeId"
                WHERE e."organizationId" = ${orgId}
                  AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= ${start}::timestamp
                  AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) <  ${end}::timestamp
                GROUP BY 1
                ORDER BY 1
            `,
        );
        return { timezone: tz, today: localDateOf(now, tz), year, month, days: rows.map((r) => ({ date: r.day, employees: r.employees })) };
    },

    /** One day: a row per employee with their sessions, the first clock-in, last clock-out and the counted total. */
    async day(orgId: string, input: AttendanceLogsDayInput, now: Date = new Date()) {
        const tz = await companyTimezone(orgId);
        const rows = await prisma.$queryRaw<LogSessionRow[]>(
            Prisma.sql`
                SELECT ws."id", ws."employeeId", e."fullName", e."employeeCode",
                       ws."checkInAt", ws."checkOutAt", ws."durationMin", ws."autoClosed", ws."approvedAt"
                FROM "work_sessions" ws
                JOIN "employees" e ON e."id" = ws."employeeId"
                WHERE e."organizationId" = ${orgId}
                  AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date = ${input.date}::date
                ORDER BY ws."checkInAt" ASC, ws."id" ASC
            `,
        );
        return buildDayLog(rows, input.date, tz, now);
    },
};
