import { describe, it, expect, vi, beforeEach } from 'vitest';

// isAuthDisabled defaults to false with no env vars set, but pin it
// explicitly so this test doesn't depend on ambient env state (same
// approach as context.test.ts).
vi.mock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => false }));

// middleware.ts and trpc.ts import each other (middleware() factory comes
// from trpc.ts; trpc.ts's procedures use middleware.ts's require* functions).
// Every other test in this codebase avoids tripping this cycle by importing
// trpc.js first (see trpc.test.ts, require-module.test.ts) — do the same
// here before importing middleware.js directly, or the TDZ reference in
// requireRole's `middleware(...)` call throws at import time.
await import('./trpc.js');
const { requireOrgRole } = await import('./middleware.js');

// ─── requireOrgRole — Task 25 ──────────────────────────────────────────────
// Checks ctx.orgRole (the caller's per-org OrganizationMember.role), never
// ctx.user.role. Unlike requireRole, ctx.user isn't even read here — proving
// that at the unit level, not just "it still passes when both happen to
// agree."

function getMiddlewareFn(builder: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (builder as any)._middlewares[0];
}

describe('requireOrgRole', () => {
    it('denies with FORBIDDEN when ctx.orgRole is null', async () => {
        const fn = getMiddlewareFn(requireOrgRole('ADMIN'));
        const ctx = { orgRole: null };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('denies with FORBIDDEN when ctx.orgRole is not in the allowed list', async () => {
        const fn = getMiddlewareFn(requireOrgRole('ADMIN'));
        const ctx = { orgRole: 'DRIVER' };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through when ctx.orgRole is in the allowed list', async () => {
        const fn = getMiddlewareFn(requireOrgRole('ADMIN', 'OPS_MANAGER'));
        const ctx = { orgRole: 'OPS_MANAGER' };
        const next = vi.fn().mockResolvedValue({ ok: true });

        await fn({ ctx, next });
        expect(next).toHaveBeenCalledWith({ ctx: { ...ctx, orgRole: ctx.orgRole } });
    });

    // The load-bearing distinction from requireRole: a global ADMIN role
    // sitting on ctx.user must have zero effect on this decision.
    it('ignores ctx.user entirely — a global ADMIN role does not leak through', async () => {
        const fn = getMiddlewareFn(requireOrgRole('ADMIN'));
        const ctx = { orgRole: 'DRIVER', user: { role: 'ADMIN' } };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
});

describe('requireOrgRole — DISABLE_AUTH bypass', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('skips the check entirely when auth is disabled', async () => {
        vi.doMock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => true }));
        await import('./trpc.js'); // establish module init order — see note above
        const { requireOrgRole: requireOrgRoleBypassed } = await import('./middleware.js');

        const fn = getMiddlewareFn(requireOrgRoleBypassed('ADMIN'));
        const ctx = { orgRole: null };
        const next = vi.fn().mockResolvedValue({ ok: true });

        await fn({ ctx, next });
        expect(next).toHaveBeenCalledWith({ ctx });
    });
});
