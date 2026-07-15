import { router, verifiedProcedure, protectedProcedure } from '../trpc/trpc.js';
import { createOrganizationSchema } from '@bin-tracker/validators';
import { authService } from '../services/auth.service.js';

export const authRouter = router({
    /**
     * First authenticated call after Supabase signup/login. Uses
     * verifiedProcedure (not protectedProcedure) — a brand-new signup has a
     * valid JWT but no local User row yet, so protectedProcedure would 401
     * before this handler could create it. See trpc.ts for the full
     * verifiedProcedure rationale (also reused by Task 19's invitation accept).
     */
    bootstrap: verifiedProcedure.mutation(async ({ ctx }) => authService.bootstrap(ctx.jwtPayload, ctx.user)),

    /**
     * Creates the caller's first organization. ownerUserId is always
     * ctx.user.id — never client input — so a caller can never provision
     * themselves as the owner of an org under someone else's identity.
     */
    createOrganization: protectedProcedure
        .input(createOrganizationSchema)
        .mutation(async ({ ctx, input }) => authService.createOrganization(ctx.user!, input.name)),
});
