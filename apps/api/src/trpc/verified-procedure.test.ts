import { describe, it, expect, vi } from 'vitest';

// isAuthDisabled defaults to false with no env vars set, but pin it
// explicitly so this test doesn't depend on ambient env state — same
// approach as context.test.ts.
vi.mock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => false }));

// trpc.ts statically imports context.ts, which imports the real Supabase
// client and throws at module-load time without SUPABASE_URL/SUPABASE_ANON_KEY.
// This test never exercises createContext, so stub jwt.ts to avoid needing
// real Supabase env vars (mirrors context.test.ts).
vi.mock('../lib/jwt.js', () => ({ verifySupabaseToken: () => Promise.resolve(null) }));

const { verifiedProcedure } = await import('./trpc.js');

// verifiedProcedure requires ctx.jwtPayload (not ctx.user) — a brand-new
// signup has a valid JWT but no local User row yet, so it must pass through
// even when ctx.user is null, and must reject when jwtPayload is null even
// if some other ctx field happens to be set.

function getVerifiedMiddlewareFn(): (opts: {
    ctx: { jwtPayload: { sub: string; email?: string } | null };
    next: (opts: { ctx: unknown }) => unknown;
}) => unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const middlewares = (verifiedProcedure as any)._def.middlewares;
    return middlewares[0];
}

describe('verifiedProcedure', () => {
    it('rejects with UNAUTHORIZED when jwtPayload is null', async () => {
        const fn = getVerifiedMiddlewareFn();
        const ctx = { jwtPayload: null };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through to next() when jwtPayload is set, even without a User row', async () => {
        const fn = getVerifiedMiddlewareFn();
        const ctx = { jwtPayload: { sub: 'user-1', email: 'a@example.com' }, user: null };
        const next = vi.fn().mockResolvedValue({ ok: true });

        await fn({ ctx, next });
        expect(next).toHaveBeenCalledWith({ ctx });
    });
});
