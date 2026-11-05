import { describe, expect, it } from 'vitest';
import { prisma } from '@bin-tracker/db';
import { dbTestsEnabled } from './test-support/db.js';

// Facts about the migrated database that a Prisma schema cannot express and a text check of the
// migration SQL cannot prove. Skipped unless DATABASE_URL is a localhost *_test / *_ci database.
const suite = dbTestsEnabled() ? describe : describe.skip;

suite('NFC attendance schema invariants (real Postgres)', () => {
    it('has the partial unique index that allows one open shift per employee', async () => {
        const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
            SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'work_sessions_one_open_per_employee'`;
        expect(rows).toHaveLength(1);
        expect(rows[0]!.indexdef).toMatch(/UNIQUE/);
        expect(rows[0]!.indexdef).toMatch(/\("employeeId"\)/);
        expect(rows[0]!.indexdef).toMatch(/WHERE.*"checkOutAt" IS NULL/);
    });

    it('has row-level security (never FORCE) on every new table', async () => {
        const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
            SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
            WHERE relname IN ('nfc_cards', 'registration_tokens', 'device_sessions') ORDER BY relname`;
        expect(rows.map((r) => r.relname)).toEqual(['device_sessions', 'nfc_cards', 'registration_tokens']);
        for (const row of rows) {
            expect(row.relrowsecurity).toBe(true);
            expect(row.relforcerowsecurity).toBe(false);
        }
    });

    it('lets an attendance event exist without a session, and detaches (not deletes) it with its session', async () => {
        const rows = await prisma.$queryRaw<Array<{ is_nullable: string }>>`
            SELECT is_nullable FROM information_schema.columns WHERE table_name = 'attendance_events' AND column_name = 'sessionId'`;
        expect(rows[0]?.is_nullable).toBe('YES');
        const fk = await prisma.$queryRaw<Array<{ confdeltype: string }>>`
            SELECT confdeltype::text AS confdeltype FROM pg_constraint WHERE conname = 'attendance_events_sessionId_fkey'`;
        expect(fk[0]?.confdeltype).toBe('n'); // 'n' = SET NULL
    });

    it('knows the three NFC event types and the three card directions', async () => {
        const events = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
            SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AttendanceEventType'`;
        expect(events.map((e) => e.enumlabel).sort()).toEqual(['CHECK_IN', 'CHECK_OUT', 'DEBOUNCED', 'REGISTERED', 'REJECTED']);
        const dirs = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
            SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'NfcDirection'`;
        expect(dirs.map((e) => e.enumlabel).sort()).toEqual(['BOTH', 'IN', 'OUT']);
    });
});
