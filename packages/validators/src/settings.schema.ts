import { z } from 'zod';

// ─── Org Payroll Settings ─────────────────────────────────────

// Server-side timezone guard: reject anything Postgres' `AT TIME ZONE` can't
// parse, because payroll.service injects companyTimezone into raw SQL and a bad
// value would break `computeRun` silently, weeks after it was saved.
const IANA_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

const RATE_CENTS_MAX = 100_000_00; // $100,000/hr — a fat-finger guard, not a real limit

export const updatePayrollSettingsSchema = z.object({
    flatHourlyRateCents: z.number().int().positive().max(RATE_CENTS_MAX),
    // Zum Rails (the payout processor) is Canadian — lock currency to CAD for now.
    currency: z.enum(['CAD']).default('CAD'),
    companyTimezone: z.string().refine((tz) => IANA_ZONES.has(tz), 'Unknown timezone'),
    // Nullable, NOT optional: the form clears the manager by sending null, never
    // "" (which `.email()` would reject).
    managerEmail: z.string().email().nullable(),
});

export type UpdatePayrollSettingsInput = z.infer<typeof updatePayrollSettingsSchema>;
