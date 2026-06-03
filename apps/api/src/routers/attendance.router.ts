import { router, publicProcedure } from '../trpc/trpc.js';
import {
    attendanceScanSchema,
    attendanceSummarySchema,
    attendanceRecentSchema,
} from '@bin-tracker/validators';
import { attendanceService } from '../services/attendance.service.js';

export const attendanceRouter = router({
    /** Guard scan — toggles check-in / check-out for the scanned badge */
    scan: publicProcedure
        .input(attendanceScanSchema)
        .mutation(async ({ input }) => {
            return attendanceService.scan(input);
        }),

    /** Per-employee total hours for the timesheet dashboard */
    summary: publicProcedure
        .input(attendanceSummarySchema)
        .query(async ({ input }) => {
            return attendanceService.summary(input);
        }),

    /** Recent scan feed */
    recent: publicProcedure
        .input(attendanceRecentSchema)
        .query(async ({ input }) => {
            return attendanceService.recent(input);
        }),
});
