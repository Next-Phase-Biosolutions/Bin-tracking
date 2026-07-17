import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ──────────────────────────────────────────────
// Covers what org-member.service.ts touches: organizationMember
// findMany/findUnique/count/update/delete, userFacility.deleteMany, and
// $transaction over already-started operations. Same single-store approach
// as invitation.service.test.ts — these tests check end state and error
// codes, not rollback semantics.

interface FakeUser {
    id: string;
    name: string;
    email: string;
}
interface FakeMembership {
    orgId: string;
    userId: string;
    role: string;
    createdAt: Date;
}
interface FakeFacility {
    id: string;
    organizationId: string;
}
interface FakeUserFacility {
    userId: string;
    facilityId: string;
}

const store = vi.hoisted(() => ({
    users: [] as FakeUser[],
    memberships: [] as FakeMembership[],
    facilities: [] as FakeFacility[],
    userFacilities: [] as FakeUserFacility[],
}));

vi.mock('@bin-tracker/db', () => {
    const withUser = (m: FakeMembership) => ({
        ...m,
        user: store.users.find((u) => u.id === m.userId),
    });

    const organizationMember = {
        findMany: ({ where }: { where: { orgId: string } }) =>
            Promise.resolve(
                store.memberships
                    .filter((m) => m.orgId === where.orgId)
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                    .map(withUser),
            ),
        findUnique: ({ where }: { where: { orgId_userId: { orgId: string; userId: string } } }) =>
            Promise.resolve(
                store.memberships.find(
                    (m) => m.orgId === where.orgId_userId.orgId && m.userId === where.orgId_userId.userId,
                ) ?? null,
            ),
        count: ({ where }: { where: { orgId: string; role: string } }) =>
            Promise.resolve(store.memberships.filter((m) => m.orgId === where.orgId && m.role === where.role).length),
        update: ({
            where,
            data,
        }: {
            where: { orgId_userId: { orgId: string; userId: string } };
            data: { role: string };
        }) => {
            const row = store.memberships.find(
                (m) => m.orgId === where.orgId_userId.orgId && m.userId === where.orgId_userId.userId,
            );
            if (!row) return Promise.reject(new Error('not found'));
            row.role = data.role;
            return Promise.resolve(withUser(row));
        },
        delete: ({ where }: { where: { orgId_userId: { orgId: string; userId: string } } }) => {
            const idx = store.memberships.findIndex(
                (m) => m.orgId === where.orgId_userId.orgId && m.userId === where.orgId_userId.userId,
            );
            if (idx === -1) return Promise.reject(new Error('not found'));
            const [row] = store.memberships.splice(idx, 1);
            return Promise.resolve(row);
        },
    };

    const userFacility = {
        deleteMany: ({
            where,
        }: {
            where: { userId: string; facility: { organizationId: string } };
        }) => {
            const orgFacilityIds = new Set(
                store.facilities.filter((f) => f.organizationId === where.facility.organizationId).map((f) => f.id),
            );
            const before = store.userFacilities.length;
            store.userFacilities = store.userFacilities.filter(
                (uf) => !(uf.userId === where.userId && orgFacilityIds.has(uf.facilityId)),
            );
            return Promise.resolve({ count: before - store.userFacilities.length });
        },
    };

    return {
        prisma: {
            organizationMember,
            userFacility,
            $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
        },
    };
});

import { listMembers, updateMemberRole, removeMember } from './org-member.service.js';

function seedMember(orgId: string, userId: string, role: string, createdAt = new Date()): void {
    store.users.push({ id: userId, name: `name-${userId}`, email: `${userId}@example.com` });
    store.memberships.push({ orgId, userId, role, createdAt });
}

beforeEach(() => {
    store.users = [];
    store.memberships = [];
    store.facilities = [];
    store.userFacilities = [];
});

describe('listMembers', () => {
    it('returns members with user info, oldest membership first', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN', new Date('2026-01-01'));
        seedMember('org-1', 'u-driver', 'DRIVER', new Date('2026-02-01'));
        seedMember('org-2', 'u-other', 'ADMIN', new Date('2026-01-15'));

        const members = await listMembers('org-1');

        expect(members.map((m) => m.userId)).toEqual(['u-admin', 'u-driver']);
        expect(members[0]).toMatchObject({ email: 'u-admin@example.com', name: 'name-u-admin', role: 'ADMIN' });
    });
});

describe('updateMemberRole', () => {
    it('changes the target role', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN');
        seedMember('org-1', 'u-worker', 'WORKER');

        const result = await updateMemberRole('org-1', 'u-admin', 'u-worker', 'OPS_MANAGER');

        expect(result.role).toBe('OPS_MANAGER');
        expect(store.memberships.find((m) => m.userId === 'u-worker')?.role).toBe('OPS_MANAGER');
    });

    it('rejects changing your own role', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN');

        await expect(updateMemberRole('org-1', 'u-admin', 'u-admin', 'WORKER')).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });

    it('rejects demoting the last admin', async () => {
        seedMember('org-1', 'u-actor', 'ADMIN');
        seedMember('org-1', 'u-target', 'ADMIN');
        // u-actor acts on u-target while being the only OTHER admin — allowed.
        // But once u-target is the only admin, demotion must fail. Simulate by
        // making the org have exactly one admin (u-target) and an OPS actor.
        store.memberships = store.memberships.filter((m) => m.userId !== 'u-actor');
        seedMember('org-1', 'u-ops', 'OPS_MANAGER');

        await expect(updateMemberRoleAs('u-ops', 'u-target', 'WORKER')).rejects.toMatchObject({ code: 'FORBIDDEN' });

        function updateMemberRoleAs(actor: string, target: string, role: 'WORKER') {
            return updateMemberRole('org-1', actor, target, role);
        }
    });

    it('allows demoting an admin when another admin remains', async () => {
        seedMember('org-1', 'u-admin1', 'ADMIN');
        seedMember('org-1', 'u-admin2', 'ADMIN');

        const result = await updateMemberRole('org-1', 'u-admin1', 'u-admin2', 'DRIVER');

        expect(result.role).toBe('DRIVER');
    });

    it('promoting a non-admin never triggers the last-admin rail', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN');
        seedMember('org-1', 'u-worker', 'WORKER');

        const result = await updateMemberRole('org-1', 'u-admin', 'u-worker', 'ADMIN');

        expect(result.role).toBe('ADMIN');
    });

    it('returns NOT_FOUND for a non-member', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN');

        await expect(updateMemberRole('org-1', 'u-admin', 'u-ghost', 'WORKER')).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });
});

describe('removeMember', () => {
    it('deletes the membership and org-scoped facility assignments only', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN');
        seedMember('org-1', 'u-driver', 'DRIVER');
        store.facilities.push({ id: 'fac-org1', organizationId: 'org-1' }, { id: 'fac-org2', organizationId: 'org-2' });
        store.userFacilities.push(
            { userId: 'u-driver', facilityId: 'fac-org1' },
            { userId: 'u-driver', facilityId: 'fac-org2' },
            { userId: 'u-admin', facilityId: 'fac-org1' },
        );

        await removeMember('org-1', 'u-admin', 'u-driver');

        expect(store.memberships.some((m) => m.userId === 'u-driver')).toBe(false);
        // org-1 assignment gone (would otherwise keep granting bin access via
        // middleware's UserFacility-only check), org-2 assignment untouched.
        expect(store.userFacilities).toEqual([
            { userId: 'u-driver', facilityId: 'fac-org2' },
            { userId: 'u-admin', facilityId: 'fac-org1' },
        ]);
        // The user row itself survives removal.
        expect(store.users.some((u) => u.id === 'u-driver')).toBe(true);
    });

    it('rejects removing yourself', async () => {
        seedMember('org-1', 'u-admin', 'ADMIN');

        await expect(removeMember('org-1', 'u-admin', 'u-admin')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects removing the last admin', async () => {
        seedMember('org-1', 'u-target', 'ADMIN');
        seedMember('org-1', 'u-ops', 'OPS_MANAGER');

        await expect(removeMember('org-1', 'u-ops', 'u-target')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows removing an admin when another admin remains', async () => {
        seedMember('org-1', 'u-admin1', 'ADMIN');
        seedMember('org-1', 'u-admin2', 'ADMIN');

        await removeMember('org-1', 'u-admin1', 'u-admin2');

        expect(store.memberships.some((m) => m.userId === 'u-admin2')).toBe(false);
    });
});
