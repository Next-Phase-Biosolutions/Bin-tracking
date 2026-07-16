import { describe, it, expect, vi } from 'vitest';
import { requireModule } from './trpc.js';

// requireModule fails closed: a missing OrganizationModule row (never
// provisioned) or an explicitly disabled row must both deny access. Only an
// explicit { enabled: true } row lets the request through.

function getMiddlewareFn(builder: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (builder as any)._middlewares[0];
}

function makeCtx(findUniqueResult: unknown) {
    return {
        orgId: 'org-1',
        prisma: {
            organizationModule: {
                findUnique: vi.fn().mockResolvedValue(findUniqueResult),
            },
        },
    };
}

describe('requireModule', () => {
    it('denies when no OrganizationModule row exists', async () => {
        const fn = getMiddlewareFn(requireModule('WORKFORCE'));
        const ctx = makeCtx(null);
        const next = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(fn({ ctx, next } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('denies when the row is explicitly disabled', async () => {
        const fn = getMiddlewareFn(requireModule('WORKFORCE'));
        const ctx = makeCtx({ enabled: false });
        const next = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(fn({ ctx, next } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through to next() when the row is enabled', async () => {
        const fn = getMiddlewareFn(requireModule('WORKFORCE'));
        const ctx = makeCtx({ enabled: true });
        const next = vi.fn().mockResolvedValue({ ok: true });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await fn({ ctx, next } as any);
        expect(next).toHaveBeenCalledWith({ ctx });
    });
});
