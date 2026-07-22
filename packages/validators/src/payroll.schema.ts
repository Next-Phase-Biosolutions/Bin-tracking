import { z } from 'zod';

// ─── Payroll Validators ───────────────────────────────────────

/** A calendar month in `YYYY-MM` form, interpreted in the company timezone. */
export const payrollPeriodSchema = z.object({
    period: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be in YYYY-MM format'),
});

export type PayrollPeriodInput = z.infer<typeof payrollPeriodSchema>;

export const payrollListSchema = z.object({
    limit: z.number().int().min(1).max(60).default(24),
});

export type PayrollListInput = z.infer<typeof payrollListSchema>;

/** Input for polling the status of an async `payroll.computeRun` job. */
export const payrollJobStatusSchema = z.object({
    jobId: z.string().min(1),
});

export type PayrollJobStatusInput = z.infer<typeof payrollJobStatusSchema>;

/**
 * Resolve a payroll exception (a dirty session held back from pay).
 * DISMISS acknowledges it (hours stay unpaid); FIX_CHECKOUT supplies the
 * missing checkout time so a recompute can include the session.
 */
export const payrollResolveExceptionSchema = z
    .object({
        exceptionId: z.string().min(1),
        action: z.enum(['DISMISS', 'FIX_CHECKOUT']),
        checkOutAt: z.string().datetime().optional(),
        note: z.string().max(500).optional(),
    })
    .refine((d) => d.action !== 'FIX_CHECKOUT' || d.checkOutAt !== undefined, {
        message: 'checkOutAt is required to fix a missing checkout',
        path: ['checkOutAt'],
    });

export type PayrollResolveExceptionInput = z.infer<typeof payrollResolveExceptionSchema>;
