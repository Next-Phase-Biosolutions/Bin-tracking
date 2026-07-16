import { describe, it, expect, vi } from 'vitest';
import { reconcileModulesForPlan } from './module.service.js';

describe('reconcileModulesForPlan', () => {
    it('adds plan-sourced modules missing for the new plan', async () => {
        const upserts: unknown[] = [];
        const prisma = {
            organizationModule: {
                findMany: vi.fn().mockResolvedValue([]),
                upsert: vi.fn().mockImplementation((args) => { upserts.push(args); return Promise.resolve(); }),
                updateMany: vi.fn(),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        await reconcileModulesForPlan(prisma, 'org_1', 'PRO');
        expect(upserts.length).toBe(6); // PRO's default bundle size
    });

    it('does not touch manually-overridden rows when downgrading', async () => {
        const prisma = {
            organizationModule: {
                findMany: vi.fn().mockResolvedValue([
                    { module: 'PAYROLL', source: 'manual', enabled: true },
                ]),
                upsert: vi.fn(),
                updateMany: vi.fn(),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        await reconcileModulesForPlan(prisma, 'org_1', 'STARTER');
        // updateMany (which disables stale plan-sourced modules) must exclude source: 'manual'
        expect(prisma.organizationModule.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ source: 'plan' }) }),
        );
    });
});
