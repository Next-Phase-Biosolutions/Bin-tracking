import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ──────────────────────────────────────────────
// Covers what invitation.service.ts touches: organization lookup, invitation
// create/find/updateMany, user upsert, organizationMember upsert. The
// transaction body runs against the same in-memory store as everything
// else — no separate "tx" store — since these tests aren't checking
// rollback semantics, just the end state and error codes.

interface FakeOrg {
    id: string;
    name: string;
}
interface FakeInvitation {
    id: string;
    orgId: string;
    email: string;
    role: string;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
}
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

const store = vi.hoisted(() => ({
    orgs: [] as FakeOrg[],
    invitations: [] as FakeInvitation[],
    users: [] as FakeUser[],
    memberships: [] as FakeMembership[],
    seq: 0,
}));

function nextId(prefix: string): string {
    store.seq += 1;
    return `${prefix}-${store.seq}`;
}

const sendInvitationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/email.js', () => ({
    sendInvitationEmail: sendInvitationEmailMock,
}));

vi.mock('@bin-tracker/db', () => {
    const organization = {
        findUnique: ({ where }: { where: { id: string } }) =>
            Promise.resolve(store.orgs.find((o) => o.id === where.id) ?? null),
    };

    const invitationModel = {
        create: ({ data }: { data: Omit<FakeInvitation, 'id' | 'acceptedAt'> }) => {
            const row: FakeInvitation = { id: nextId('inv'), acceptedAt: null, ...data };
            store.invitations.push(row);
            return Promise.resolve(row);
        },
        findUnique: ({ where }: { where: { token: string } }) =>
            Promise.resolve(store.invitations.find((i) => i.token === where.token) ?? null),
        updateMany: ({
            where,
            data,
        }: {
            where: { id: string; acceptedAt: null };
            data: { acceptedAt: Date };
        }) => {
            const row = store.invitations.find((i) => i.id === where.id && i.acceptedAt === where.acceptedAt);
            if (!row) return Promise.resolve({ count: 0 });
            row.acceptedAt = data.acceptedAt;
            return Promise.resolve({ count: 1 });
        },
    };

    const user = {
        upsert: ({ where, create }: { where: { id: string }; update: Partial<FakeUser>; create: FakeUser }) => {
            const existing = store.users.find((u) => u.id === where.id);
            if (existing) return Promise.resolve(existing);
            store.users.push({ ...create });
            return Promise.resolve({ ...create });
        },
    };

    const organizationMember = {
        upsert: ({
            where,
            create,
        }: {
            where: { orgId_userId: { orgId: string; userId: string } };
            update: Record<string, never>;
            create: FakeMembership;
        }) => {
            const existing = store.memberships.find(
                (m) => m.orgId === where.orgId_userId.orgId && m.userId === where.orgId_userId.userId,
            );
            if (existing) return Promise.resolve(existing);
            store.memberships.push({ ...create });
            return Promise.resolve({ ...create });
        },
    };

    interface FakePrisma {
        organization: typeof organization;
        invitation: typeof invitationModel;
        user: typeof user;
        organizationMember: typeof organizationMember;
        $transaction: (fn: (tx: FakePrisma) => Promise<void>) => Promise<void>;
    }

    const prisma: FakePrisma = {
        organization,
        invitation: invitationModel,
        user,
        organizationMember,
        $transaction: async (fn) => fn(prisma),
    };

    return { prisma };
});

const { invitationService } = await import('./invitation.service.js');

beforeEach(() => {
    store.orgs = [{ id: 'org-1', name: 'Acme Inc' }, { id: 'org-2', name: 'Beta Co' }];
    store.invitations = [];
    store.users = [];
    store.memberships = [];
    store.seq = 0;
    sendInvitationEmailMock.mockReset();
    sendInvitationEmailMock.mockResolvedValue(undefined);
});

function makeInvitation(overrides: Partial<FakeInvitation> = {}): FakeInvitation {
    const row: FakeInvitation = {
        id: nextId('inv'),
        orgId: 'org-1',
        email: 'invitee@example.com',
        role: 'OPS_MANAGER',
        token: nextId('token'),
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        ...overrides,
    };
    store.invitations.push(row);
    return row;
}

describe('invitationService.createInvitation', () => {
    it('creates an invitation with a 7-day expiry and emails the invite link', async () => {
        const result = await invitationService.createInvitation('org-1', 'new@example.com', 'DRIVER');

        expect(store.invitations).toHaveLength(1);
        expect(store.invitations[0]).toMatchObject({ orgId: 'org-1', email: 'new@example.com', role: 'DRIVER' });
        expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);

        expect(sendInvitationEmailMock).toHaveBeenCalledWith(
            'new@example.com',
            expect.stringContaining(store.invitations[0]!.token),
            'Acme Inc',
        );
    });

    it('throws NOT_FOUND for an org that does not exist', async () => {
        await expect(invitationService.createInvitation('missing-org', 'a@example.com', 'DRIVER')).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });
});

describe('invitationService.acceptInvitation', () => {
    it('rejects an expired invitation with BAD_REQUEST', async () => {
        const invitation = makeInvitation({ expiresAt: new Date(Date.now() - 1000) });

        await expect(
            invitationService.acceptInvitation(invitation.token, { sub: 'user-1', email: 'invitee@example.com' }, null),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects a double-accept with BAD_REQUEST', async () => {
        const invitation = makeInvitation();
        const jwt = { sub: 'user-1', email: 'invitee@example.com' };

        await invitationService.acceptInvitation(invitation.token, jwt, null);
        await expect(invitationService.acceptInvitation(invitation.token, jwt, null)).rejects.toMatchObject({
            code: 'BAD_REQUEST',
        });
    });

    it('rejects an unknown token with BAD_REQUEST', async () => {
        await expect(
            invitationService.acceptInvitation('does-not-exist', { sub: 'user-1', email: 'a@example.com' }, null),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('creates the membership in the org the invitation belongs to, not any other org', async () => {
        const invitation = makeInvitation({ orgId: 'org-2', role: 'WORKER' });

        const result = await invitationService.acceptInvitation(
            invitation.token,
            { sub: 'user-1', email: 'invitee@example.com' },
            null,
        );

        expect(result.orgId).toBe('org-2');
        expect(store.memberships).toHaveLength(1);
        expect(store.memberships[0]).toEqual({ orgId: 'org-2', userId: 'user-1' });
        // Never org-1, even though that's the first/only other org in the fixture.
        expect(store.memberships.some((m) => m.orgId === 'org-1')).toBe(false);
    });

    it('creates the local User row with the role from the invitation, not ADMIN', async () => {
        const invitation = makeInvitation({ role: 'DRIVER' });

        await invitationService.acceptInvitation(invitation.token, { sub: 'user-1', email: 'invitee@example.com' }, null);

        expect(store.users).toHaveLength(1);
        expect(store.users[0]).toMatchObject({ id: 'user-1', email: 'invitee@example.com', role: 'DRIVER' });
    });

    it('marks the invitation as accepted', async () => {
        const invitation = makeInvitation();

        await invitationService.acceptInvitation(invitation.token, { sub: 'user-1', email: 'invitee@example.com' }, null);

        expect(store.invitations[0]!.acceptedAt).not.toBeNull();
    });

    it('falls back to the DISABLE_AUTH-injected user when jwtPayload is null', async () => {
        const invitation = makeInvitation({ orgId: 'org-1' });
        const fallback = { id: 'admin-seed', email: 'admin@seed.com', name: 'Seed Admin', role: 'ADMIN' };

        const result = await invitationService.acceptInvitation(invitation.token, null, fallback as never);

        expect(result.orgId).toBe('org-1');
        expect(store.memberships[0]).toEqual({ orgId: 'org-1', userId: 'admin-seed' });
    });

    it('rejects when there is no jwtPayload and no fallback user', async () => {
        const invitation = makeInvitation();
        await expect(invitationService.acceptInvitation(invitation.token, null, null)).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
        });
    });
});
