import { describe, it, expect, vi } from 'vitest';
import { resolveOrgId } from './org-context.js';

describe('resolveOrgId', () => {
    it('resolves org and org-scoped role from user membership', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue({ orgId: 'org_1', role: 'DRIVER' }) },
            facility: { findUnique: vi.fn() },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1', facilityId: null })).toEqual({
            orgId: 'org_1',
            orgRole: 'DRIVER',
        });
    });

    it('resolves org from station facility with a null orgRole (stations have no role)', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn() },
            facility: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org_2' }) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: null, facilityId: 'f1' })).toEqual({
            orgId: 'org_2',
            orgRole: null,
        });
    });

    it('returns null orgId and null orgRole when neither resolves', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
            facility: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1', facilityId: 'f1' })).toEqual({
            orgId: null,
            orgRole: null,
        });
    });

    // Task 25 regression: a user's membership role must win over anything
    // that could be confused with a global role — the ADMIN string here is
    // deliberately different from what a "global role" fixture would use
    // elsewhere, proving this function only ever reads the per-membership
    // role column, never touches `users.role`.
    it('returns the membership role even when it differs from what a global role would be', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue({ orgId: 'org_3', role: 'WORKER' }) },
            facility: { findUnique: vi.fn() },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await resolveOrgId(prisma as any, { userId: 'u2', facilityId: null });
        expect(result.orgRole).toBe('WORKER');
    });
});
