import { router, orgAdminProcedure, verifiedProcedure } from '../trpc/trpc.js';
import { inviteRateLimit } from '../trpc/rate-limit.js';
import {
    createInvitationSchema,
    acceptInvitationSchema,
    revokeInvitationSchema,
    updateMemberRoleSchema,
    removeMemberSchema,
} from '@bin-tracker/validators';
import { invitationService } from '../services/invitation.service.js';
import { orgMemberService } from '../services/org-member.service.js';

/**
 * Team invitations (Task 19). Kept as its own router rather than folded
 * into auth.router.ts — "Team invitations" is a distinct concern from org
 * bootstrap/creation and this keeps auth.router.ts's diff untouched.
 */
export const invitationRouter = router({
    /**
     * Invite a teammate (ADMIN only). orgId always comes from ctx.orgId,
     * resolved by orgAdminProcedure from the caller's own membership — never
     * client input — so an admin can only ever invite into their own org.
     */
    create: orgAdminProcedure
        .use(inviteRateLimit())
        .input(createInvitationSchema)
        .mutation(async ({ ctx, input }) => invitationService.createInvitation(ctx.orgId, input.email, input.role)),

    /**
     * Accept an invitation. Uses verifiedProcedure (not protectedProcedure)
     * for the same reason as auth.bootstrap: a person accepting their
     * first-ever invite has a valid Supabase JWT but no local User row yet,
     * so protectedProcedure would 401 before the handler could create it.
     */
    accept: verifiedProcedure
        .input(acceptInvitationSchema)
        .mutation(async ({ ctx, input }) => invitationService.acceptInvitation(input.token, ctx.jwtPayload, ctx.user)),

    /** Pending (unaccepted) invitations for the settings page's Team section. */
    list: orgAdminProcedure.query(async ({ ctx }) => invitationService.listInvitations(ctx.orgId)),

    /** Revoke a pending invitation — the emailed link stops working. */
    revoke: orgAdminProcedure
        .input(revokeInvitationSchema)
        .mutation(async ({ ctx, input }) => invitationService.revokeInvitation(ctx.orgId, input.invitationId)),

    /**
     * Member management (settings page). Same trust story as create: orgId
     * and the actor's identity always come from ctx, never client input.
     * The self/last-admin rails live in org-member.service.ts.
     */
    members: orgAdminProcedure.query(async ({ ctx }) => orgMemberService.listMembers(ctx.orgId)),

    updateMemberRole: orgAdminProcedure
        .input(updateMemberRoleSchema)
        .mutation(async ({ ctx, input }) => orgMemberService.updateMemberRole(ctx.orgId, ctx.user!.id, input.userId, input.role)),

    removeMember: orgAdminProcedure
        .input(removeMemberSchema)
        .mutation(async ({ ctx, input }) => orgMemberService.removeMember(ctx.orgId, ctx.user!.id, input.userId)),
});
