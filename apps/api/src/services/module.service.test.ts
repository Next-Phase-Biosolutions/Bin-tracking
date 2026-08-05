import { describe, it, expect, vi } from 'vitest';
import { reconcileModulesForPlan, getEnabledModules, setModuleOverride } from './module.service.js';

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
        expect(upserts.length).toBe(7); // PRO's default bundle size
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

// Action Item 2, Test Case 1: module resolution for the demo org.
describe('setModuleOverride + getEnabledModules — ENVIRONMENT_MONITORING', () => {
    it('enabling via setModuleOverride is reflected by getEnabledModules with source: manual', async () => {
        let stored: { orgId: string; module: string; enabled: boolean; source: string; updatedBy: string } | null = null;
        const prisma = {
            organizationModule: {
                upsert: vi.fn().mockImplementation(({ create }) => {
                    stored = { ...create };
                    return Promise.resolve(stored);
                }),
                findMany: vi.fn().mockImplementation(() =>
                    Promise.resolve(stored && stored.enabled ? [{ module: stored.module }] : []),
                ),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        await setModuleOverride(prisma, {
            orgId: 'org-demo',
            module: 'ENVIRONMENT_MONITORING',
            enabled: true,
            updatedBy: 'platform-admin-1',
        });
        const enabled = await getEnabledModules(prisma, 'org-demo');

        expect(enabled).toContain('ENVIRONMENT_MONITORING');
        expect(stored).not.toBeNull();
        expect(stored!.source).toBe('manual');
    });
});

// Action Item 2, Test Case 3: existing orgs are not silently backfilled.
describe('getEnabledModules — existing-org non-regression', () => {
    it('does not report ENVIRONMENT_MONITORING for an org with no OrganizationModule row for it, even though every plan now defaults to including it', async () => {
        const prisma = {
            organizationModule: {
                // Pre-existing org: rows only for modules it had before this change.
                findMany: vi.fn().mockResolvedValue([{ module: 'WORKFORCE' }, { module: 'SHIPMENTS' }]),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const enabled = await getEnabledModules(prisma, 'org-existing');

        expect(enabled).not.toContain('ENVIRONMENT_MONITORING');
    });
});
