import { describe, it, expect } from 'vitest';
import type { SafeEmployee } from '@bin-tracker/db';

/**
 * Guards the one line that keeps employee bank PII out of every API response:
 * the global `omit` in packages/db/src/client.ts.
 *
 * These are TYPE-level assertions on purpose. The leak this prevents isn't a
 * behaviour a runtime test could observe without a real database — it's that
 * `employee.list`, `employee.getById`, `employee.register` and
 * `payroll.getRun` all return Prisma rows straight to the client. If someone
 * deletes the omit config, `SafeEmployee` regains those fields and this file
 * stops compiling, failing `pnpm typecheck` in CI.
 *
 * A test that only ran at runtime would pass happily while the columns went
 * out over the wire.
 */

/** Compile error if `Field` is present on SafeEmployee. */
type MustBeOmitted<Field extends string> = Field extends keyof SafeEmployee ? never : true;

// If any line below errors with "Type 'never' is not assignable to type
// 'true'", that field is being returned by the API. Do not "fix" it by
// deleting the line.
const bankInstitutionIsOmitted: MustBeOmitted<'bankInstitution'> = true;
const bankTransitIsOmitted: MustBeOmitted<'bankTransit'> = true;
const bankAccountIsOmitted: MustBeOmitted<'bankAccount'> = true;
const accountHolderNameIsOmitted: MustBeOmitted<'accountHolderName'> = true;
const bankLinkTokenIsOmitted: MustBeOmitted<'bankLinkToken'> = true;

/** Compile error if `Field` is MISSING — these are needed by the UI. */
type MustBePresent<Field extends string> = Field extends keyof SafeEmployee ? true : never;

const last4IsVisible: MustBePresent<'bankAccountLast4'> = true;
const accountTypeIsVisible: MustBePresent<'accountType'> = true;
const bankDetailsAtIsVisible: MustBePresent<'bankDetailsAt'> = true;

describe('employee bank fields are never exposed through Prisma', () => {
    it('omits every credential-bearing field from the client type', () => {
        expect([
            bankInstitutionIsOmitted,
            bankTransitIsOmitted,
            bankAccountIsOmitted,
            accountHolderNameIsOmitted,
            bankLinkTokenIsOmitted,
        ]).toEqual([true, true, true, true, true]);
    });

    it('keeps the display-only fields the dashboard needs', () => {
        expect([last4IsVisible, accountTypeIsVisible, bankDetailsAtIsVisible]).toEqual([true, true, true]);
    });
});
