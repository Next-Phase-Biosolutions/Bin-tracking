import { describe, it, expect, vi } from 'vitest';
import { resolveOrgId } from './org-context.js';

describe('resolveOrgId', () => {
    it('resolves org and org-scoped role from user membership', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue({ orgId: 'org_1', role: 'DRIVER' }) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1' })).toEqual({
            orgId: 'org_1',
            orgRole: 'DRIVER',
        });
    });

    it('returns null orgId and null orgRole when the user has no membership', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1' })).toEqual({
            orgId: null,
            orgRole: null,
        });
    });

    it('returns null orgId and null orgRole for an unauthenticated caller', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn() },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: null })).toEqual({
            orgId: null,
            orgRole: null,
        });
        expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();
    });

    // ─── x-org-id explicit org selection ───────────────────────────────
    it('resolves the requested org when the user is a member of it', async () => {
        const prisma = {
            organizationMember: {
                findUnique: vi.fn().mockResolvedValue({ orgId: 'org_second', role: 'DRIVER' }),
                findFirst: vi.fn(),
            },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await resolveOrgId(prisma as any, { userId: 'u1', requestedOrgId: 'org_second' });
        expect(result).toEqual({ orgId: 'org_second', orgRole: 'DRIVER' });
        expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
            where: { orgId_userId: { orgId: 'org_second', userId: 'u1' } },
            select: { orgId: true, role: true },
        });
        expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();
    });

    it('fails CLOSED for a requested org the user is not a member of — no fallback to the default org', async () => {
        const prisma = {
            organizationMember: {
                findUnique: vi.fn().mockResolvedValue(null), // not a member of the requested org
                findFirst: vi.fn().mockResolvedValue({ orgId: 'org_default', role: 'ADMIN' }), // their real org
            },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await resolveOrgId(prisma as any, { userId: 'u1', requestedOrgId: 'org_other' });
        expect(result).toEqual({ orgId: null, orgRole: null });
        expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled(); // never falls back
    });

    // Task 25 regression: a user's membership role must win over anything
    // that could be confused with a global role — the ADMIN string here is
    // deliberately different from what a "global role" fixture would use
    // elsewhere, proving this function only ever reads the per-membership
    // role column, never touches `users.role`.
    it('returns the membership role even when it differs from what a global role would be', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue({ orgId: 'org_3', role: 'WORKER' }) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await resolveOrgId(prisma as any, { userId: 'u2' });
        expect(result.orgRole).toBe('WORKER');
    });
});
