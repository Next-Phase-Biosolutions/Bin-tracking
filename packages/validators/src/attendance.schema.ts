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
