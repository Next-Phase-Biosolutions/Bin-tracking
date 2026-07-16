import { describe, it, expect, vi } from 'vitest';
import { orgAdminProcedure, orgOpsProcedure } from './trpc.js';

// ─── orgAdminProcedure / orgOpsProcedure — Task 25 regression ─────────────
// These must gate on ctx.orgRole (the caller's OrganizationMember.role for
// the resolved org), never on ctx.user.role (the global role). Before this
// task, both procedures used requireRole('ADMIN'[, 'OPS_MANAGER']), which
// checked the global role — an account with global ADMIN (which every
// self-serve signup gets via bootstrap()) would pass regardless of what
// role a target org's admin actually invited them as. Mirrors
// admin.router.test.ts's approach of pulling the raw middleware function
// off the procedure builder rather than spinning up a full tRPC server.

function getFirstMiddlewareFn(builder: unknown): (opts: {
    ctx: { orgRole: string | null };
    next: (opts: { ctx: unknown }) => unknown;
}) => unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (builder as any)._def.middlewares[0];
}

describe('orgAdminProcedure', () => {
    it('denies a caller whose GLOBAL role is ADMIN but org role is DRIVER (the exploit scenario)', async () => {
        const fn = getFirstMiddlewareFn(orgAdminProcedure);
        // ctx deliberately omits `user` entirely — requireOrgRole must never
        // need to consult it. Only orgRole (the org-scoped membership role)
        // should matter for this decision.
        const ctx = { orgRole: 'DRIVER' };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('denies a caller with no org membership (orgRole null)', async () => {
        const fn = getFirstMiddlewareFn(orgAdminProcedure);
        const ctx = { orgRole: null };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through a caller whose org role is ADMIN', async () => {
        const fn = getFirstMiddlewareFn(orgAdminProcedure);
        const ctx = { orgRole: 'ADMIN' };
        const next = vi.fn().mockResolvedValue({ ok: true });

        await fn({ ctx, next });
        expect(next).toHaveBeenCalledWith({ ctx });
    });
});

describe('orgOpsProcedure', () => {
    it('denies a caller whose GLOBAL role is ADMIN but org role is WORKER', async () => {
        const fn = getFirstMiddlewareFn(orgOpsProcedure);
        const ctx = { orgRole: 'WORKER' };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through a caller whose org role is OPS_MANAGER', async () => {
        const fn = getFirstMiddlewareFn(orgOpsProcedure);
        const ctx = { orgRole: 'OPS_MANAGER' };
        const next = vi.fn().mockResolvedValue({ ok: true });

        await fn({ ctx, next });
        expect(next).toHaveBeenCalledWith({ ctx });
    });
});
