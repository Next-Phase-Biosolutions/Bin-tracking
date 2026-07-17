import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ──────────────────────────────────────────────
// Covers what auth.service.ts's bootstrap()/createOrganization() touch:
// user upsert, organizationMember lookup, organization slug lookup.

interface FakeUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

interface FakeMembership {
    orgId: string;
    userId: string;
}

interface FakeOrganization {
    id: string;
    slug: string;
}

const store = vi.hoisted(() => ({
    users: [] as FakeUser[],
    memberships: [] as FakeMembership[],
    organizations: [] as FakeOrganization[],
    upsertCallCount: 0,
}));

const provisionOrganizationMock = vi.hoisted(() => vi.fn());
const createTrialSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock('@bin-tracker/db', () => {
    const user = {
        upsert: ({ where, create }: { where: { id: string }; update: Partial<FakeUser>; create: FakeUser }) => {
            store.upsertCallCount += 1;
            const existing = store.users.find((u) => u.id === where.id);
            if (existing) return Promise.resolve(existing);
            store.users.push({ ...create });
            return Promise.resolve({ ...create });
        },
        update: ({ where, data }: { where: { id: string }; data: { name: string } }) => {
            const row = store.users.find((u) => u.id === where.id);
            if (!row) return Promise.reject(new Error('not found'));
            row.name = data.name;
            return Promise.resolve({ id: row.id, name: row.name, email: row.email });
        },
    };
    const organizationMember = {
        findFirst: ({ where }: { where: { userId: string } }) =>
            Promise.resolve(store.memberships.find((m) => m.userId === where.userId) ?? null),
    };
    const organization = {
        findUnique: ({ where }: { where: { slug: string } }) =>
            Promise.resolve(store.organizations.find((o) => o.slug === where.slug) ?? null),
    };

    return { prisma: { user, organizationMember, organization } };
});

vi.mock('./org-provision.service.js', () => ({
    provisionOrganization: provisionOrganizationMock,
}));

vi.mock('./billing.service.js', () => ({
    createTrialSubscription: createTrialSubscriptionMock,
}));

const { authService } = await import('./auth.service.js');

beforeEach(() => {
    store.users = [];
    store.memberships = [];
    store.organizations = [];
    store.upsertCallCount = 0;
    provisionOrganizationMock.mockReset();
    provisionOrganizationMock.mockResolvedValue({ orgId: 'org-new' });
    createTrialSubscriptionMock.mockReset();
    delete process.env['BILLING_ENABLED'];
});

describe('authService.bootstrap', () => {
    it('creates a User row on first call with the least-privileged global role, never ADMIN', async () => {
        const result = await authService.bootstrap({ sub: 'user-1', email: 'a@example.com' }, null);

        expect(store.users).toHaveLength(1);
        // Global ADMIN-by-default was the raw material for the Task 25
        // privilege escalation — org authority comes from the membership
        // provisionOrganization() grants, not from this row.
        expect(store.users[0]).toMatchObject({ id: 'user-1', email: 'a@example.com', role: 'WORKER' });
        expect(result.user.id).toBe('user-1');
    });

    it('is idempotent: calling twice results in exactly one User row', async () => {
        await authService.bootstrap({ sub: 'user-1', email: 'a@example.com' }, null);
        await authService.bootstrap({ sub: 'user-1', email: 'a@example.com' }, null);

        expect(store.users).toHaveLength(1);
        expect(store.upsertCallCount).toBe(2); // both calls hit upsert, but only one row exists
    });

    it('reports needsOrg: true when the user has no membership', async () => {
        const result = await authService.bootstrap({ sub: 'user-1', email: 'a@example.com' }, null);
        expect(result.needsOrg).toBe(true);
    });

    it('reports needsOrg: false when the user already belongs to an org', async () => {
        store.memberships.push({ orgId: 'org-1', userId: 'user-1' });
        const result = await authService.bootstrap({ sub: 'user-1', email: 'a@example.com' }, null);
        expect(result.needsOrg).toBe(false);
    });

    it('rejects a JWT with no email claim', async () => {
        await expect(authService.bootstrap({ sub: 'user-1' }, null)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('falls back to the DISABLE_AUTH-injected user when jwtPayload is null', async () => {
        const fallback = { id: 'admin-seed', email: 'admin@seed.com', name: 'Seed Admin', role: 'ADMIN' };
        const result = await authService.bootstrap(null, fallback as never);

        expect(store.users).toHaveLength(0); // never touches the User table in this path
        expect(result.user.id).toBe('admin-seed');
    });

    it('rejects when there is no jwtPayload and no fallback user', async () => {
        await expect(authService.bootstrap(null, null)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
});

describe('authService.createOrganization', () => {
    it('passes owner.id as ownerUserId to provisionOrganization', async () => {
        await authService.createOrganization({ id: 'user-1', email: 'a@example.com' }, 'Acme Inc');

        expect(provisionOrganizationMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ ownerUserId: 'user-1', name: 'Acme Inc' }),
        );
    });

    it('slugifies the org name', async () => {
        const result = await authService.createOrganization({ id: 'user-1', email: 'a@example.com' }, 'Acme Inc!!');
        expect(result.slug).toBe('acme-inc');
    });

    it('appends -2, -3 on slug collision', async () => {
        store.organizations.push({ id: 'org-existing', slug: 'acme-inc' });
        store.organizations.push({ id: 'org-existing-2', slug: 'acme-inc-2' });

        const result = await authService.createOrganization({ id: 'user-1', email: 'a@example.com' }, 'Acme Inc');
        expect(result.slug).toBe('acme-inc-3');
    });

    it('does not call createTrialSubscription when BILLING_ENABLED is not "true"', async () => {
        await authService.createOrganization({ id: 'user-1', email: 'a@example.com' }, 'Acme Inc');
        expect(createTrialSubscriptionMock).not.toHaveBeenCalled();
    });

    it('calls createTrialSubscription with the owner email when BILLING_ENABLED is "true"', async () => {
        process.env['BILLING_ENABLED'] = 'true';
        await authService.createOrganization({ id: 'user-1', email: 'a@example.com' }, 'Acme Inc');
        expect(createTrialSubscriptionMock).toHaveBeenCalledWith('org-new', 'a@example.com');
    });
});

describe('authService.updateProfile', () => {
    it('updates the name and returns the trimmed-down profile', async () => {
        store.users.push({ id: 'user-1', email: 'a@example.com', name: 'old', role: 'ADMIN' });

        const result = await authService.updateProfile('user-1', 'New Name');

        expect(result).toEqual({ id: 'user-1', name: 'New Name', email: 'a@example.com' });
        expect(store.users[0]?.name).toBe('New Name');
    });
});
