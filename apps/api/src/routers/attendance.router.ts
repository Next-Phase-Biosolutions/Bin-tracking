import { router, publicProcedure, orgProcedure, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import {
    attendanceScanSchema,
    attendanceSummarySchema,
    attendanceRecentSchema,
    attendanceApproveSessionSchema,
    nfcTapSchema,
} from '@bin-tracker/validators';
import { attendanceService } from '../services/attendance.service.js';
import { tap } from '../services/nfc-tap.service.js';
import { TERMINAL_TOKEN_ERRORS } from '../services/device-registration.service.js';
import { tapRateLimit } from '../trpc/rate-limit.js';
import { AppError } from '../lib/app-error.js';
import {
    DEVICE_COOKIE,
    PENDING_COOKIE,
    assertTrustedOrigin,
    clearCookie,
    deviceCookieOptions,
    readCookie,
    setCookie,
} from '../lib/nfc-cookies.js';

// Reviewing forgotten check-outs and watching the floor is ADMIN / OPS_MANAGER only.
const manager = orgOpsProcedure.use(requireModule('WORKFORCE'));

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

    /**
     * Employee: a phone tapped a wall-mounted NFC card. NOT behind a user JWT —
     * the phone authenticates with its device cookie (a hashed DeviceSession),
     * and the organization is read from the card, never from client input. With
     * a pending-registration cookie present the same tap completes registration.
     */
    tap: publicProcedure
        .use(tapRateLimit())
        .input(nfcTapSchema)
        .mutation(async ({ input, ctx }) => {
            assertTrustedOrigin(ctx.req);
            const deviceToken = readCookie(ctx.req, DEVICE_COOKIE);
            const pendingHash = readCookie(ctx.req, PENDING_COOKIE);
            try {
                const { result, newDeviceToken } = await tap({
                    cardId: input.cardId,
                    deviceToken,
                    pendingHash,
                    userAgent: ctx.req.headers['user-agent'],
                });
                if (newDeviceToken) {
                    setCookie(ctx.res, DEVICE_COOKIE, newDeviceToken, deviceCookieOptions());
                    clearCookie(ctx.res, PENDING_COOKIE);
                }
                return result;
            } catch (e) {
                // A dead registration link must not keep a stale pending cookie around.
                if (pendingHash && e instanceof AppError && TERMINAL_TOKEN_ERRORS.has(e.appCode)) {
                    clearCookie(ctx.res, PENDING_COOKIE);
                }
                throw e;
            }
        }),

    /** Who is in the building right now (read-only; no pay rates, no QR codes). */
    facilityStatus: manager.query(({ ctx }) => attendanceService.facilityStatus(ctx.orgId)),

    /** Auto-closed (forgotten check-out) sessions waiting for approval. */
    listPendingApprovals: manager.query(({ ctx }) => attendanceService.listPendingApprovals(ctx.orgId)),

    /** Approve an auto-closed session as-is, or with the real check-out time. */
    approveWorkSession: manager
        .input(attendanceApproveSessionSchema)
        .mutation(({ input, ctx }) => attendanceService.approveWorkSession(ctx.orgId, ctx.user?.id ?? null, input)),
});
