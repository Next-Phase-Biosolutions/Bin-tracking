import { router, verifiedProcedure, protectedProcedure } from '../trpc/trpc.js';
import { createOrganizationSchema, updateProfileSchema } from '@bin-tracker/validators';
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

    /**
     * Who am I, for the settings page and sidebar: local profile plus the
     * caller's ORG role (OrganizationMember.role via ctx — see org-context.ts;
     * NOT the informational global user.role). Everything read from ctx.
     */
    me: protectedProcedure.query(({ ctx }) => ({
        id: ctx.user!.id,
        email: ctx.user!.email,
        name: ctx.user!.name,
        orgId: ctx.orgId,
        orgRole: ctx.orgRole,
    })),

    /**
     * Every organization the caller belongs to (oldest first), for the org
     * switcher. Not org-scoped — reads the caller's own memberships directly,
     * so it works regardless of which org `x-org-id` currently resolves to
     * (and even if a stale selected org no longer applies). The frontend only
     * shows a switcher when this returns more than one.
     */
    myOrgs: protectedProcedure.query(async ({ ctx }) => {
        const memberships = await ctx.prisma.organizationMember.findMany({
            where: { userId: ctx.user!.id },
            select: { orgId: true, role: true, organization: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
        });
        return memberships.map((m) => ({ orgId: m.orgId, name: m.organization.name, role: m.role }));
    }),

    updateProfile: protectedProcedure
        .input(updateProfileSchema)
        .mutation(async ({ ctx, input }) => authService.updateProfile(ctx.user!.id, input.name)),
});
