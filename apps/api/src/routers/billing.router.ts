import { z } from 'zod';
import { router, orgAdminProcedure, orgProcedure, publicProcedure } from '../trpc/trpc.js';
import { billingService } from '../services/billing.service.js';
import { getEnabledModules } from '../services/module.service.js';

export const billingRouter = router({
    /** Starts a Stripe Checkout session for the org to subscribe/upgrade to `plan`. */
    createCheckoutSession: orgAdminProcedure
        .input(z.object({ plan: z.enum(['STARTER', 'PRO', 'ENTERPRISE']) }))
        .mutation(async ({ ctx, input }) => billingService.createCheckoutSession(ctx.orgId, input.plan)),

    /** Starts a Stripe customer portal session so the org can manage its subscription. */
    createPortalSession: orgAdminProcedure.mutation(async ({ ctx }) => billingService.createPortalSession(ctx.orgId)),

    /** Current plan/status/renewal date for the org. */
    current: orgProcedure.query(async ({ ctx }) => billingService.getCurrentSubscription(ctx.orgId)),

    /** Modules currently enabled for the org (Task 17: drives nav filtering + hasModule on the frontend). */
    enabledModules: orgProcedure.query(async ({ ctx }) => getEnabledModules(ctx.prisma, ctx.orgId)),

    /**
     * Whether billing is turned on at all. Public (no tenant data) — the
     * frontend (Task 17) uses this to hide billing UI during the free
     * launch period, before any org context is resolved.
     */
    status: publicProcedure.query(() => ({ enabled: process.env['BILLING_ENABLED'] === 'true' })),
});
