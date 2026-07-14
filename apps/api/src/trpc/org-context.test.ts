import { describe, it, expect, vi } from 'vitest';
import { resolveOrgId } from './org-context.js';

describe('resolveOrgId', () => {
    it('resolves org from user membership', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue({ orgId: 'org_1' }) },
            facility: { findUnique: vi.fn() },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1', facilityId: null })).toBe('org_1');
    });

    it('resolves org from station facility', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn() },
            facility: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org_2' }) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: null, facilityId: 'f1' })).toBe('org_2');
    });

    it('returns null when neither resolves', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
            facility: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1', facilityId: 'f1' })).toBe(null);
    });
});
