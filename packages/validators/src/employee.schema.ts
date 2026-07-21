import { z } from 'zod';

// ─── Employee Validators ──────────────────────────────────────

export const employeeRegisterSchema = z.object({
    fullName: z.string().min(1, 'Full name is required').max(120),
    email: z.string().email('Invalid email').optional(),
    phone: z.string().max(30).optional(),
    department: z.string().max(80).optional(),
    position: z.string().max(80).optional(),
});

export type EmployeeRegisterInput = z.infer<typeof employeeRegisterSchema>;

export const employeeGetByIdSchema = z.object({
    id: z.string().min(1),
});

export type EmployeeGetByIdInput = z.infer<typeof employeeGetByIdSchema>;

export const employeeListSchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    /** Case-insensitive match against fullName, employeeCode, and department */
    search: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(200).default(100),
});

export type EmployeeListInput = z.infer<typeof employeeListSchema>;

// ─── Bank details (EFT payout) ────────────────────────────────
// A typo here becomes a failed bank transfer days later, so every rule is
// enforced server-side, not just in the form.

/**
 * People copy these numbers off a cheque, where they're printed with spaces
 * and dashes. Strip those BEFORE the length check, so "700-1234" is accepted
 * as the valid 7-digit account it is, and digits-only is what gets stored.
 */
const digitsOnly = (schema: z.ZodString) =>
    z
        .string()
        .transform((value) => value.replace(/[\s-]/g, ''))
        .pipe(schema);

export const employeeBankDetailsSchema = z.object({
    bankInstitution: digitsOnly(z.string().regex(/^\d{3}$/, 'Institution number must be exactly 3 digits')),
    bankTransit: digitsOnly(z.string().regex(/^\d{5}$/, 'Transit number must be exactly 5 digits')),
    bankAccount: digitsOnly(z.string().regex(/^\d{7,12}$/, 'Account number must be 7 to 12 digits')),
    accountHolderName: z
        .string()
        .trim()
        .min(1, 'Account holder name is required')
        .max(120)
        .describe('Must match the name on the bank account'),
    accountType: z.enum(['CHEQUING', 'SAVINGS']),
    email: z.string().email('Invalid email'),
});

export type EmployeeBankDetailsInput = z.infer<typeof employeeBankDetailsSchema>;

/** Public submission — the link token is the sole credential (no session). */
export const employeeBankSubmitSchema = employeeBankDetailsSchema.extend({
    token: z.string().min(1),
});

export type EmployeeBankSubmitInput = z.infer<typeof employeeBankSubmitSchema>;

export const employeeBankLinkSchema = z.object({
    token: z.string().min(1),
});

export type EmployeeBankLinkInput = z.infer<typeof employeeBankLinkSchema>;

export const employeeRequestBankDetailsSchema = z.object({
    employeeId: z.string().min(1),
});

export type EmployeeRequestBankDetailsInput = z.infer<typeof employeeRequestBankDetailsSchema>;
