import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
    return new PrismaClient({
        adapter,
        /**
         * Employee bank PII is excluded from EVERY Prisma read, globally.
         *
         * Enforcing this per-caller would be a losing game: `employee.service`
         * returns whole rows from register/list/getById, `payroll.service`
         * embeds employees via `include: { employee: true }`, and any future
         * query would have to remember. One global omit covers all of them,
         * including nested includes, and keeps covering code nobody has
         * written yet.
         *
         * `bankLinkToken` is here for the same reason it's hashed at rest —
         * it's a live credential, not display data.
         *
         * The only code that legitimately needs these values (bank-crypto
         * decrypt paths) opts back in per-query with `omit: { bankAccount:
         * false, ... }`. Note that `select` and `omit` cannot be combined at
         * the same level — use the omit override, not a select.
         *
         * Deliberately NOT omitted: `accountType`, `bankAccountLast4` and
         * `bankDetailsAt` — they drive the "✓ ****1234 / not set" UI without
         * exposing anything that can move money.
         */
        omit: {
            employee: {
                bankInstitution: true,
                bankTransit: true,
                bankAccount: true,
                accountHolderName: true,
                bankLinkToken: true,
            },
        },
        log:
            process.env['NODE_ENV'] === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
    });
}

// Typed off createPrismaClient rather than bare PrismaClient: the global
// `omit` narrows the client's generics, so the two are no longer assignable.
const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
    globalForPrisma.prisma = prisma;
}

/**
 * The configured client's type. The global `omit` above narrows
 * `PrismaClient`'s generics, so a bare `PrismaClient` annotation no longer
 * accepts this instance — anything taking the client as a parameter should
 * use this instead.
 */
export type DbClient = typeof prisma;

/**
 * An employee as the application can ever see one: the bank PII fields are
 * stripped by the global omit, so they are absent from the TYPE too. Any code
 * that tries to read `employee.bankAccount` now fails to compile rather than
 * silently returning `undefined` — the type is the enforcement, not a
 * convention someone has to remember.
 */
export type SafeEmployee = Awaited<ReturnType<typeof prisma.employee.findFirstOrThrow>>;
