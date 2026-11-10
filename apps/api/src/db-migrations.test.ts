import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Action Item 2, Test Case 2: the ModuleKey enum-value migration must be
// applied in complete isolation. Postgres forbids ALTER TYPE ... ADD VALUE
// and any statement that *uses* that new value inside the same transaction,
// and Prisma wraps every migration in one transaction — so this migration
// file must contain nothing but the ADD VALUE statement.
//
// This check lives here (apps/api) rather than in packages/db because
// packages/db has no test runner configured; it is pure filesystem
// inspection and has no runtime dependency on apps/api itself.
describe('ENVIRONMENT_MONITORING enum-value migration isolation', () => {
    it('contains only the ALTER TYPE ADD VALUE statement, nothing that uses the new value', () => {
        const migrationPath = join(
            dirname(fileURLToPath(import.meta.url)),
            '../../../packages/db/prisma/migrations/20260805130000_add_environment_monitoring_module_value/migration.sql',
        );
        const sql = readFileSync(migrationPath, 'utf-8');
        const statements = sql
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('--'));

        expect(statements).toEqual([`ALTER TYPE "ModuleKey" ADD VALUE 'ENVIRONMENT_MONITORING';`]);
    });
});

// Sensor fleet management migration: reads the SQL as text (no Prisma client
// import) and checks the parts a drift check can't see — the data backfills,
// the six seeded zones, the CHECK constraint (Prisma doesn't model CHECKs) and
// RLS on every new table (ENABLE only; FORCE breaks Prisma's owner connection).
describe('sensor fleet management migration', () => {
    const migrationPath = join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../packages/db/prisma/migrations/20261030090000_sensor_fleet_management/migration.sql',
    );

    it('seeds the six default zones, adds the ACTIVE-is-assigned CHECK and enables RLS on every new table', () => {
        const sql = readFileSync(migrationPath, 'utf-8');

        for (const slug of ['receiving', 'killfloor', 'processing', 'wetaging', 'valueadd', 'shipping']) {
            expect(sql).toContain(`'${slug}'`);
        }
        expect(sql).toContain('sensor_devices_active_is_assigned');
        for (const table of ['zones', 'unknown_sensor_device_ids', 'sensor_device_audit_logs', 'platform_settings']) {
            expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        }
        expect(sql).not.toContain('FORCE ROW LEVEL SECURITY');
    });
});

// NFC attendance migrations. Text inspection only (no Prisma client), same as
// above: the enum values must be applied in complete isolation, and the second
// migration carries the parts a drift check cannot see — the partial unique
// index, the duplicate-open-session cleanup that must run BEFORE it, and RLS.
describe('NFC attendance migrations', () => {
    const migrationsDir = join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../packages/db/prisma/migrations',
    );
    const read = (dir: string) => readFileSync(join(migrationsDir, dir, 'migration.sql'), 'utf-8');

    it('adds the AttendanceEventType values in a migration that contains nothing else', () => {
        const statements = read('20261104120000_attendance_event_nfc_types')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('--'));

        expect(statements).toEqual([
            `ALTER TYPE "AttendanceEventType" ADD VALUE 'DEBOUNCED';`,
            `ALTER TYPE "AttendanceEventType" ADD VALUE 'REJECTED';`,
            `ALTER TYPE "AttendanceEventType" ADD VALUE 'REGISTERED';`,
        ]);
    });

    it('creates the one-open-session partial unique index only after the duplicate cleanup', () => {
        const sql = read('20261104120100_nfc_attendance');
        const cleanup = sql.indexOf('WITH open_sessions AS');
        const index = sql.indexOf('CREATE UNIQUE INDEX "work_sessions_one_open_per_employee"');

        expect(cleanup).toBeGreaterThan(-1);
        expect(index).toBeGreaterThan(cleanup);
        expect(sql).toContain('WHERE "checkOutAt" IS NULL');
        // Cleaned-up duplicates must surface as payroll exceptions, not be paid.
        expect(sql).toContain('"autoClosed" = true');
        expect(sql).not.toMatch(/"approvedAt"\s*=/);
    });

    it('enables RLS (never FORCE) on every new table', () => {
        const sql = read('20261104120100_nfc_attendance');

        for (const table of ['nfc_cards', 'registration_tokens', 'device_sessions']) {
            expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        }
        expect(sql).not.toContain('FORCE ROW LEVEL SECURITY');
    });
});
