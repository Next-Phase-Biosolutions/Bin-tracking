import { describe, it, expect, vi } from 'vitest';

// billing.router.ts's `enabledModules` is a thin orgProcedure wrapper around
// getEnabledModules (Task 12, re-exported at services/module.service.ts).
// Mock at that boundary and drive the router through createCaller so we
// prove ctx.prisma / ctx.orgId are forwarded rather than re-testing
// getEnabledModules's own DB logic (already covered where it's implemented).
const getEnabledModulesMock = vi.fn();

vi.mock('../services/module.service.js', () => ({
    getEnabledModules: getEnabledModulesMock,
}));

vi.mock('../services/billing.service.js', () => ({
    billingService: {
        createCheckoutSession: vi.fn(),
        createPortalSession: vi.fn(),
        getCurrentSubscription: vi.fn(),
    },
}));

const { billingRouter } = await import('./billing.router.js');

describe('billing.enabledModules', () => {
    it('calls getEnabledModules with ctx.prisma and ctx.orgId, and returns its result', async () => {
        const fakePrisma = { marker: 'fake-prisma' };
        getEnabledModulesMock.mockResolvedValue(['WORKFORCE', 'SHIPMENTS']);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caller = billingRouter.createCaller({ prisma: fakePrisma, orgId: 'org-1', user: { id: 'user-1' } } as any);
        const result = await caller.enabledModules();

        expect(getEnabledModulesMock).toHaveBeenCalledWith(fakePrisma, 'org-1');
        expect(result).toEqual(['WORKFORCE', 'SHIPMENTS']);
    });
});
