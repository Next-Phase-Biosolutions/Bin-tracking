import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prisma } from '@bin-tracker/db';
import { dbTestsEnabled } from './test-support/db.js';

// The duplicate-open-session cleanup in the NFC migration, run against real rows. The migration SQL is
// read from the file and executed against a TEMP copy of work_sessions that shadows the real table for
// this one transaction, so nothing real is touched and the unique index on the real table is not dropped.
const suite = dbTestsEnabled() ? describe : describe.skip;

const migration = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../packages/db/prisma/migrations/20261104120100_nfc_attendance/migration.sql'),
    'utf-8',
);
const cleanupSql = migration.slice(migration.indexOf('WITH open_sessions AS'), migration.indexOf('-- At most one open shift per employee'));

const H = 3_600_000;
const base = new Date('2031-05-05T00:00:00Z');
const hoursAfter = (h: number) => new Date(base.getTime() + h * H);

type Row = { id: string; employeeId: string; checkInAt: Date; checkOutAt: Date | null; durationMin: number | null; autoClosed: boolean; approvedAt: Date | null };

async function runCleanup(rows: Array<Pick<Row, 'id' | 'employeeId' | 'checkInAt'> & Partial<Row>>): Promise<Record<string, Row>> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE TEMP TABLE work_sessions (LIKE public.work_sessions INCLUDING DEFAULTS) ON COMMIT DROP`);
        for (const r of rows) {
            await tx.$executeRawUnsafe(
                `INSERT INTO work_sessions ("id","employeeId","checkInAt","checkOutAt","durationMin","autoClosed","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())`,
                r.id, r.employeeId, r.checkInAt, r.checkOutAt ?? null, r.durationMin ?? null, r.autoClosed ?? false,
            );
        }
        await tx.$executeRawUnsafe(cleanupSql);
        const out = await tx.$queryRawUnsafe<Row[]>(`SELECT "id","employeeId","checkInAt","checkOutAt","durationMin","autoClosed","approvedAt" FROM work_sessions`);
        return Object.fromEntries(out.map((r) => [r.id, r]));
    });
}

suite('NFC migration: duplicate open shift cleanup (real Postgres, temp table)', () => {
    it('keeps the newest open shift open and auto-closes the older ones, unapproved, so payroll flags them', async () => {
        const out = await runCleanup([
            { id: 'old', employeeId: 'e1', checkInAt: hoursAfter(0) },
            { id: 'mid', employeeId: 'e1', checkInAt: hoursAfter(30) },
            { id: 'new', employeeId: 'e1', checkInAt: hoursAfter(40) },
        ]);

        expect(out['new']).toMatchObject({ checkOutAt: null, autoClosed: false });
        expect(out['old']).toMatchObject({ autoClosed: true, approvedAt: null, durationMin: 960 }); // capped at 16 h
        expect(out['old']!.checkOutAt!.getTime()).toBe(hoursAfter(16).getTime());
        expect(out['mid']).toMatchObject({ autoClosed: true, approvedAt: null, durationMin: 600 }); // clipped at the newest check-in (10 h), not 16 h
        expect(out['mid']!.checkOutAt!.getTime()).toBe(hoursAfter(40).getTime());
    });

    it('never lets a cleaned-up shift end after the newest one starts', async () => {
        const out = await runCleanup([
            { id: 'a', employeeId: 'e1', checkInAt: hoursAfter(0) },
            { id: 'b', employeeId: 'e1', checkInAt: hoursAfter(5) },
        ]);

        expect(out['a']!.checkOutAt!.getTime()).toBe(hoursAfter(5).getTime()); // min(0 + 16 h, 5 h)
        expect(out['a']!.durationMin).toBe(300);
    });

    it('leaves employees with a single open shift, closed shifts and other employees completely alone', async () => {
        const closed = { checkOutAt: hoursAfter(8), durationMin: 480 };
        const out = await runCleanup([
            { id: 'solo', employeeId: 'e2', checkInAt: hoursAfter(0) },
            { id: 'closed-1', employeeId: 'e3', checkInAt: hoursAfter(0), ...closed },
            { id: 'closed-2', employeeId: 'e3', checkInAt: hoursAfter(10), ...closed, checkOutAt: hoursAfter(18) },
            { id: 'open-3', employeeId: 'e3', checkInAt: hoursAfter(20) },
        ]);

        expect(out['solo']).toMatchObject({ checkOutAt: null, autoClosed: false });
        expect(out['closed-1']).toMatchObject({ durationMin: 480, autoClosed: false });
        expect(out['open-3']).toMatchObject({ checkOutAt: null, autoClosed: false });
    });

    it('is a no-op on a table with no duplicates', async () => {
        const out = await runCleanup([{ id: 'only', employeeId: 'e9', checkInAt: hoursAfter(0) }]);
        expect(out['only']).toMatchObject({ checkOutAt: null, autoClosed: false, durationMin: null });
    });

    it('lets the unique index be created afterwards: no employee is left with two open shifts', async () => {
        const out = await runCleanup([
            { id: 'x1', employeeId: 'e1', checkInAt: hoursAfter(0) },
            { id: 'x2', employeeId: 'e1', checkInAt: hoursAfter(1) },
            { id: 'x3', employeeId: 'e1', checkInAt: hoursAfter(2) },
            { id: 'y1', employeeId: 'e2', checkInAt: hoursAfter(0) },
            { id: 'y2', employeeId: 'e2', checkInAt: hoursAfter(3) },
        ]);

        const stillOpen = Object.values(out).filter((r) => r.checkOutAt === null);
        expect(stillOpen.map((r) => r.id).sort()).toEqual(['x3', 'y2']);
    });
});
