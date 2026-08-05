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
