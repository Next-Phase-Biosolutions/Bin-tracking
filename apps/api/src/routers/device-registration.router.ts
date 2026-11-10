import { router, publicProcedure, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import { registerStartSchema, sendRegistrationLinkSchema, emailRegistrationLinkSchema, revokeDeviceSessionSchema } from '@bin-tracker/validators';
import { deviceRegistrationService } from '../services/device-registration.service.js';
import { registrationStartRateLimit } from '../trpc/rate-limit.js';
import { PENDING_COOKIE, assertTrustedOrigin, pendingCookieOptions, setCookie } from '../lib/nfc-cookies.js';

// Issuing links and revoking phones is ADMIN / OPS_MANAGER only, inside WORKFORCE.
const admin = orgOpsProcedure.use(requireModule('WORKFORCE'));

export const deviceRegistrationRouter = router({
    /** Manager: mint a single-use registration link for one employee. */
    sendLink: admin.input(sendRegistrationLinkSchema).mutation(({ input, ctx }) => deviceRegistrationService.sendLink(ctx.orgId, input.employeeId)),

    /** Manager: email an issued link to the employee's address on file (the link is rebuilt server-side from the token). */
    emailLink: admin.input(emailRegistrationLinkSchema).mutation(({ input, ctx }) => deviceRegistrationService.emailLink(ctx.orgId, input.employeeId, input.token)),

    /** Manager: every active phone in the org (the web groups them by employee). */
    listDevices: admin.query(({ ctx }) => deviceRegistrationService.listDevices(ctx.orgId)),

    /** Manager: lock out a lost or compromised phone. */
    revokeDevice: admin.input(revokeDeviceSessionSchema).mutation(({ input, ctx }) => deviceRegistrationService.revokeDevice(ctx.orgId, input.id)),

    /**
     * Employee: the registration link was opened. The single-use hashed token is
     * the only credential. A mutation (not a query) so the token travels in the
     * POST body, not in access logs — same reasoning as bankLinkContext.
     */
    start: publicProcedure
        .use(registrationStartRateLimit())
        .input(registerStartSchema)
        .mutation(async ({ input, ctx }) => {
            assertTrustedOrigin(ctx.req);
            const { pendingSecret, employeeName } = await deviceRegistrationService.start(input.token);
            setCookie(ctx.res, PENDING_COOKIE, pendingSecret, pendingCookieOptions());
            return { employeeName };
        }),
});
