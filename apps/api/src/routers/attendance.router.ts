import { router, orgProcedure, requireModule } from '../trpc/trpc.js';
import {
    attendanceScanSchema,
    attendanceSummarySchema,
    attendanceRecentSchema,
} from '@bin-tracker/validators';
import { attendanceService } from '../services/attendance.service.js';

export const attendanceRouter = router({
    /** Guard scan — toggles check-in / check-out for the scanned badge */
    scan: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(attendanceScanSchema)
        .mutation(async ({ input, ctx }) => {
            return attendanceService.scan(ctx.orgId, input);
        }),

    /** Per-employee total hours for the timesheet dashboard */
    summary: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(attendanceSummarySchema)
        .query(async ({ input, ctx }) => {
            return attendanceService.summary(ctx.orgId, input);
        }),

    /** Recent scan feed */
    recent: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(attendanceRecentSchema)
        .query(async ({ input, ctx }) => {
            return attendanceService.recent(ctx.orgId, input);
        }),
});
