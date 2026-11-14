import { z } from 'zod';

// ─── Attendance Validators ────────────────────────────────────

export const attendanceScanSchema = z.object({
    /** The exact string encoded in the employee's QR code */
    qrCode: z.string().min(1, 'QR code is required'),
    /** Optional label for the scanning device / guard post */
    source: z.string().max(80).optional(),
});

export type AttendanceScanInput = z.infer<typeof attendanceScanSchema>;

export const attendanceSummarySchema = z
    .object({
        /** Inclusive start of the reporting window (ISO string) */
        from: z.string().datetime().optional(),
        /** Exclusive end of the reporting window (ISO string) */
        to: z.string().datetime().optional(),
    })
    .refine(
        (val) => !val.from || !val.to || new Date(val.from) <= new Date(val.to),
        { message: '`from` must be before `to`', path: ['from'] },
    );

export type AttendanceSummaryInput = z.infer<typeof attendanceSummarySchema>;

export const attendanceRecentSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20),
});

export type AttendanceRecentInput = z.infer<typeof attendanceRecentSchema>;

/**
 * Manager review of an auto-closed (forgotten check-out) session. Without
 * `checkOutAt` the capped shift is approved as-is; with one, that real
 * check-out time is used instead.
 */
export const attendanceApproveSessionSchema = z.object({
    id: z.string().min(1).max(200),
    checkOutAt: z.string().datetime({ offset: true }).optional(),
});

export type AttendanceApproveSessionInput = z.infer<typeof attendanceApproveSessionSchema>;

/** How an organization's employees clock in: NFC tag taps (default) or the original QR badge scan. */
export const attendanceMethodSchema = z.enum(['NFC', 'QR']);

export const setAttendanceMethodSchema = z.object({ method: attendanceMethodSchema });

export type AttendanceMethodInput = z.infer<typeof attendanceMethodSchema>;
export type SetAttendanceMethodInput = z.infer<typeof setAttendanceMethodSchema>;

// ─── Attendance Logs (manager view: a calendar month, then one day) ───────────

const isRealDate = (value: string): boolean => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** One calendar month: how many employees clocked in on each day. */
export const attendanceLogsMonthSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
});

/** One day (`YYYY-MM-DD`, in the company's timezone): who clocked in and out. */
export const attendanceLogsDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD').refine(isRealDate, 'Not a real calendar date'),
});

export type AttendanceLogsMonthInput = z.infer<typeof attendanceLogsMonthSchema>;
export type AttendanceLogsDayInput = z.infer<typeof attendanceLogsDaySchema>;
