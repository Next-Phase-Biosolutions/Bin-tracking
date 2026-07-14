import { router, protectedProcedure, stationProcedure } from '../trpc/trpc.js';
import {
    attendanceScanSchema,
    attendanceSummarySchema,
    attendanceRecentSchema,
} from '@bin-tracker/validators';
import { attendanceService } from '../services/attendance.service.js';

export const attendanceRouter = router({
    /** Guard scan — toggles check-in / check-out for the scanned badge */
    scan: stationProcedure
        .input(attendanceScanSchema)
        .mutation(async ({ input }) => {
            return attendanceService.scan(input);
        }),

    /** Per-employee total hours for the timesheet dashboard */
    summary: protectedProcedure
        .input(attendanceSummarySchema)
        .query(async ({ input }) => {
            return attendanceService.summary(input);
        }),

    /** Recent scan feed */
    recent: protectedProcedure
        .input(attendanceRecentSchema)
        .query(async ({ input }) => {
            return attendanceService.recent(input);
        }),
});
