import { describe, it, expect, vi } from 'vitest';
import { platformAdminProcedure } from '../trpc/trpc.js';

// ─── platformAdminProcedure ────────────────────────────────────────────────
// isPlatformAdmin is an orthogonal, org-independent flag on User (deliberately
// separate from the org-scoped ADMIN role) — only a user with
// isPlatformAdmin: true may pass. Mirrors require-module.test.ts's approach
// of pulling the raw middleware function off the procedure builder rather
// than spinning up a full tRPC server.

function getPlatformAdminMiddlewareFn(): (opts: {
    ctx: { user: { isPlatformAdmin: boolean } | null };
    next: (opts: { ctx: unknown }) => unknown;
}) => unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const middlewares = (platformAdminProcedure as any)._def.middlewares;
    // index 0 = isAuthenticated (protectedProcedure's own gate), index 1 = isPlatformAdmin
    return middlewares[1];
}

describe('platformAdminProcedure', () => {
    it('rejects with FORBIDDEN when the user is not a platform admin', async () => {
        const fn = getPlatformAdminMiddlewareFn();
        const ctx = { user: { isPlatformAdmin: false } };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with FORBIDDEN when there is no user at all', async () => {
        const fn = getPlatformAdminMiddlewareFn();
        const ctx = { user: null };
        const next = vi.fn();

        await expect(fn({ ctx, next })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });

    it('passes through to next() when the user is a platform admin', async () => {
        const fn = getPlatformAdminMiddlewareFn();
        const ctx = { user: { isPlatformAdmin: true } };
        const next = vi.fn().mockResolvedValue({ ok: true });

        await fn({ ctx, next });
        expect(next).toHaveBeenCalledWith({ ctx });
    });
});

// ─── adminService.toggleModule ─────────────────────────────────────────────
// Uses a hoisted in-memory fake for @bin-tracker/db (same pattern as
// tenancy-isolation.test.ts) so we can assert on the exact upsert payload
// (source must always be 'manual') and prove writes never cross org boundaries.

interface FakeOrgModule {
    orgId: string;
    module: string;
    enabled: boolean;
    source: string;
    updatedBy: string | null;
}

const store = vi.hoisted(() => ({ modules: [] as FakeOrgModule[] }));

vi.mock('@bin-tracker/db', () => {
    const organizationModule = {
        upsert: ({
            where,
            update,
            create,
        }: {
            where: { orgId_module: { orgId: string; module: string } };
            update: Partial<FakeOrgModule>;
            create: FakeOrgModule;
        }) => {
            const existing = store.modules.find(
                (m) => m.orgId === where.orgId_module.orgId && m.module === where.orgId_module.module,
            );
            if (existing) {
                Object.assign(existing, update);
                return Promise.resolve({ ...existing });
            }
            store.modules.push({ ...create });
            return Promise.resolve({ ...create });
        },
    };

    // toggleModule now reads the pre-toggle state and writes an audit entry.
    const organizationModuleWithFind = {
        ...organizationModule,
        findUnique: ({ where }: { where: { orgId_module: { orgId: string; module: string } } }) => {
            const row = store.modules.find(
                (m) => m.orgId === where.orgId_module.orgId && m.module === where.orgId_module.module,
            );
            return Promise.resolve(row ? { ...row } : null);
        },
    };
    const fakePrisma = {
        organizationModule: organizationModuleWithFind,
        payrollAuditLog: { create: ({ data }: { data: unknown }) => Promise.resolve(data) },
    };

    // setModuleOverride re-implemented against the fake store, mirroring the
    // real packages/db/src/module-service.ts implementation exactly (always
    // source: 'manual').
    async function setModuleOverride(
        _prisma: unknown,
        input: { orgId: string; module: string; enabled: boolean; updatedBy: string },
    ) {
        await organizationModule.upsert({
            where: { orgId_module: { orgId: input.orgId, module: input.module } },
            update: { enabled: input.enabled, source: 'manual', updatedBy: input.updatedBy },
            create: {
                orgId: input.orgId,
                module: input.module,
                enabled: input.enabled,
                source: 'manual',
                updatedBy: input.updatedBy,
            },
        });
    }

    return { prisma: fakePrisma, setModuleOverride };
});

const { adminService } = await import('../services/admin.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';

describe('adminService.toggleModule', () => {
    it('always writes source: manual, never plan', async () => {
        store.modules.length = 0;

        await adminService.toggleModule({ orgId: ORG_A, module: 'PAYROLL', enabled: true }, 'platform-admin-1');

        const row = store.modules.find((m) => m.orgId === ORG_A && m.module === 'PAYROLL');
        expect(row?.source).toBe('manual');
        expect(row?.updatedBy).toBe('platform-admin-1');
    });

    it('toggling a module for org A never creates or modifies a row for org B', async () => {
        store.modules.length = 0;
        store.modules.push({ orgId: ORG_B, module: 'PAYROLL', enabled: true, source: 'plan', updatedBy: null });

        await adminService.toggleModule({ orgId: ORG_A, module: 'PAYROLL', enabled: false }, 'platform-admin-1');

        const orgBRow = store.modules.find((m) => m.orgId === ORG_B && m.module === 'PAYROLL');
        expect(orgBRow).toEqual({ orgId: ORG_B, module: 'PAYROLL', enabled: true, source: 'plan', updatedBy: null });

        const orgARow = store.modules.find((m) => m.orgId === ORG_A && m.module === 'PAYROLL');
        expect(orgARow?.enabled).toBe(false);
        expect(orgARow?.source).toBe('manual');
    });
});
