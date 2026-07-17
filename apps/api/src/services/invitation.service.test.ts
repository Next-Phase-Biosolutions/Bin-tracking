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
    createdAt: Date;
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
    role: string;
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
        create: ({ data }: { data: Omit<FakeInvitation, 'id' | 'acceptedAt' | 'createdAt'> }) => {
            const row: FakeInvitation = { id: nextId('inv'), acceptedAt: null, createdAt: new Date(), ...data };
            store.invitations.push(row);
            return Promise.resolve(row);
        },
        findMany: ({ where }: { where: { orgId: string; acceptedAt: null } }) =>
            Promise.resolve(
                store.invitations
                    .filter((i) => i.orgId === where.orgId && i.acceptedAt === where.acceptedAt)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map(({ id, email, role, createdAt, expiresAt }) => ({ id, email, role, createdAt, expiresAt })),
            ),
        deleteMany: ({ where }: { where: { id: string; orgId: string; acceptedAt: null } }) => {
            const idx = store.invitations.findIndex(
                (i) => i.id === where.id && i.orgId === where.orgId && i.acceptedAt === where.acceptedAt,
            );
            if (idx === -1) return Promise.resolve({ count: 0 });
            store.invitations.splice(idx, 1);
            return Promise.resolve({ count: 1 });
        },
        findUnique: ({ where }: { where: { token: string } }) =>
            Promise.resolve(store.invitations.find((i) => i.token === where.token) ?? null),
        // Faithful to the where-clauses createInvitation may send: orgId +
        // email + acceptedAt: null, with expiresAt > now applied only when
        // the service actually filters on it.
        findFirst: ({
            where,
        }: {
            where: { orgId: string; email: string; acceptedAt: null; expiresAt?: { gt: Date } };
        }) =>
            Promise.resolve(
                store.invitations.find(
                    (i) =>
                        i.orgId === where.orgId &&
                        i.email === where.email &&
                        i.acceptedAt === null &&
                        (!where.expiresAt || i.expiresAt.getTime() > where.expiresAt.gt.getTime()),
                ) ?? null,
            ),
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeInvitation> }) => {
            const row = store.invitations.find((i) => i.id === where.id);
            if (!row) return Promise.reject(new Error('not found'));
            Object.assign(row, data);
            return Promise.resolve({ ...row });
        },
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
        // update is genuinely applied (not just ignored) on the existing-row
        // branch — Task 25's fix depends on the `update` branch of the real
        // upsert actually writing `role`, so the fake has to model that or
        // the regression test below would pass for the wrong reason.
        upsert: ({
            where,
            update,
            create,
        }: {
            where: { orgId_userId: { orgId: string; userId: string } };
            update: Partial<FakeMembership>;
            create: FakeMembership;
        }) => {
            const existing = store.memberships.find(
                (m) => m.orgId === where.orgId_userId.orgId && m.userId === where.orgId_userId.userId,
            );
            if (existing) {
                Object.assign(existing, update);
                return Promise.resolve({ ...existing });
            }
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
const { hashToken } = await import('../lib/token.js');

beforeEach(() => {
    store.orgs = [{ id: 'org-1', name: 'Acme Inc' }, { id: 'org-2', name: 'Beta Co' }];
    store.invitations = [];
    store.users = [];
    store.memberships = [];
    store.seq = 0;
    sendInvitationEmailMock.mockReset();
    sendInvitationEmailMock.mockResolvedValue(undefined);
});

// The store holds the HASHED token (as the real DB now does); the returned
// object carries the raw token — what the emailed link would contain and what
// tests present to acceptInvitation. A raw-token lookup against the store
// would find nothing, proving the service hashes before lookup.
function makeInvitation(overrides: Partial<FakeInvitation> = {}): FakeInvitation {
    const rawToken = nextId('token');
    const row: FakeInvitation = {
        id: nextId('inv'),
        orgId: 'org-1',
        email: 'invitee@example.com',
        role: 'OPS_MANAGER',
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        createdAt: new Date(),
        ...overrides,
        token: hashToken(overrides.token ?? rawToken),
    };
    store.invitations.push(row);
    return { ...row, token: overrides.token ?? rawToken };
}

describe('invitationService.createInvitation', () => {
    it('creates an invitation with a 7-day expiry and emails the invite link', async () => {
        const result = await invitationService.createInvitation('org-1', 'new@example.com', 'DRIVER');

        expect(store.invitations).toHaveLength(1);
        expect(store.invitations[0]).toMatchObject({ orgId: 'org-1', email: 'new@example.com', role: 'DRIVER' });
        expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);

        // The emailed link carries the RAW token; the DB row holds only its
        // hash — the two must correspond, and the raw value must never be
        // what's stored.
        const [to, inviteUrl, orgName] = sendInvitationEmailMock.mock.calls[0]!;
        expect(to).toBe('new@example.com');
        expect(orgName).toBe('Acme Inc');
        const rawToken = String(inviteUrl).split('/invite/')[1]!;
        expect(hashToken(rawToken)).toBe(store.invitations[0]!.token);
        expect(rawToken).not.toBe(store.invitations[0]!.token);
    });

    it('throws NOT_FOUND for an org that does not exist', async () => {
        await expect(invitationService.createInvitation('missing-org', 'a@example.com', 'DRIVER')).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });

    it('re-inviting the same email rotates the pending invitation instead of stacking a second one', async () => {
        const first = await invitationService.createInvitation('org-1', 'new@example.com', 'DRIVER');
        const firstToken = store.invitations[0]!.token;

        const second = await invitationService.createInvitation('org-1', 'New@Example.com', 'OPS_MANAGER');

        expect(store.invitations).toHaveLength(1); // updated in place
        expect(store.invitations[0]!.token).not.toBe(firstToken); // fresh token
        expect(store.invitations[0]!.role).toBe('OPS_MANAGER'); // latest role wins
        expect(second.expiresAt.getTime()).toBeGreaterThanOrEqual(first.expiresAt.getTime());
        expect(sendInvitationEmailMock).toHaveBeenCalledTimes(2); // resend still goes out
    });

    it('re-inviting after expiry rotates the expired row instead of stacking a second one', async () => {
        await invitationService.createInvitation('org-1', 'new@example.com', 'DRIVER');
        const expiredToken = store.invitations[0]!.token;
        store.invitations[0]!.expiresAt = new Date(Date.now() - 1000); // force-expire

        const fresh = await invitationService.createInvitation('org-1', 'new@example.com', 'DRIVER');

        expect(store.invitations).toHaveLength(1); // rotated in place, no duplicate
        expect(store.invitations[0]!.token).not.toBe(expiredToken); // fresh token
        expect(fresh.expiresAt.getTime()).toBeGreaterThan(Date.now()); // live again
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

    it('rejects an accept from an account that does not own the invited email', async () => {
        const invitation = makeInvitation({ email: 'invitee@example.com' });
        await expect(
            invitationService.acceptInvitation(invitation.token, { sub: 'someone-else', email: 'attacker@example.com' }, null),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(store.memberships).toHaveLength(0);
        expect(store.invitations[0]!.acceptedAt).toBeNull(); // still usable by the real invitee
    });

    it('matches the invited email case-insensitively', async () => {
        const invitation = makeInvitation({ email: 'Invitee@Example.com' });
        const result = await invitationService.acceptInvitation(
            invitation.token,
            { sub: 'user-1', email: 'invitee@example.com' },
            null,
        );
        expect(result.orgId).toBe('org-1');
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
        expect(store.memberships[0]).toEqual({ orgId: 'org-2', userId: 'user-1', role: 'WORKER' });
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
        expect(store.memberships[0]).toEqual({ orgId: 'org-1', userId: 'admin-seed', role: 'OPS_MANAGER' });
    });

    it('rejects when there is no jwtPayload and no fallback user', async () => {
        const invitation = makeInvitation();
        await expect(invitationService.acceptInvitation(invitation.token, null, null)).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
        });
    });

    // ─── Task 25 regression: the actual privilege-escalation hole ─────────
    // An account that already has global role ADMIN (from having bootstrapped
    // an unrelated org previously) accepts an invitation into a DIFFERENT org
    // as DRIVER. Before this fix, the membership upsert's `update` branch was
    // `update: {}` — a no-op — so an existing user's membership role was
    // never set/reconciled to what the invitation actually granted, and every
    // org-scoped authorization check read the global (ADMIN) role instead.
    // The membership for THIS org must end up DRIVER, not ADMIN.
    it('sets the membership role to the invitation role, not the existing global ADMIN role — first accept', async () => {
        // Existing account with global role ADMIN, no memberships yet.
        store.users.push({ id: 'existing-admin', email: 'existing-admin@example.com', name: 'Existing Admin', role: 'ADMIN' });
        const invitation = makeInvitation({ orgId: 'org-2', role: 'DRIVER', email: 'existing-admin@example.com' });

        const result = await invitationService.acceptInvitation(
            invitation.token,
            { sub: 'existing-admin', email: 'existing-admin@example.com' },
            null,
        );

        expect(result.role).toBe('DRIVER');
        const membership = store.memberships.find((m) => m.userId === 'existing-admin' && m.orgId === 'org-2');
        expect(membership?.role).toBe('DRIVER');
        // The global User.role is untouched by this call (update: {} on the
        // user upsert's existing-row branch is intentional — see the
        // function's doc comment) — it stays cosmetic/informational once
        // authorization no longer reads it for org-scoped decisions.
        expect(store.users.find((u) => u.id === 'existing-admin')?.role).toBe('ADMIN');
    });

    // Same scenario, but the membership already exists (a re-invite of an
    // existing member) — the upsert's UPDATE branch must also apply the new
    // role, not just the CREATE branch.
    it('updates the membership role to the invitation role on a re-invite of an existing member', async () => {
        store.users.push({ id: 'existing-admin', email: 'existing-admin@example.com', name: 'Existing Admin', role: 'ADMIN' });
        store.memberships.push({ orgId: 'org-2', userId: 'existing-admin', role: 'ADMIN' }); // stale/incorrect prior role
        const invitation = makeInvitation({ orgId: 'org-2', role: 'DRIVER', email: 'existing-admin@example.com' });

        await invitationService.acceptInvitation(
            invitation.token,
            { sub: 'existing-admin', email: 'existing-admin@example.com' },
            null,
        );

        expect(store.memberships).toHaveLength(1); // updated in place, not duplicated
        expect(store.memberships[0]?.role).toBe('DRIVER');
    });
});

describe('invitationService.listInvitations', () => {
    it('returns unaccepted invitations (including expired) newest first, scoped to the org', async () => {
        makeInvitation({ email: 'old@example.com', createdAt: new Date('2026-01-01') });
        makeInvitation({ email: 'new@example.com', createdAt: new Date('2026-02-01') });
        makeInvitation({ email: 'expired@example.com', createdAt: new Date('2026-01-15'), expiresAt: new Date(Date.now() - 1) });
        makeInvitation({ email: 'accepted@example.com', acceptedAt: new Date() });
        makeInvitation({ email: 'foreign@example.com', orgId: 'org-2' });

        const list = await invitationService.listInvitations('org-1');

        expect(list.map((i) => i.email)).toEqual(['new@example.com', 'expired@example.com', 'old@example.com']);
    });
});

describe('invitationService.revokeInvitation', () => {
    it('deletes a pending invitation', async () => {
        const inv = makeInvitation();

        await invitationService.revokeInvitation('org-1', inv.id);

        expect(store.invitations).toHaveLength(0);
    });

    it('rejects revoking an invitation from another org', async () => {
        const foreign = makeInvitation({ orgId: 'org-2' });

        await expect(invitationService.revokeInvitation('org-1', foreign.id)).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
        expect(store.invitations).toHaveLength(1);
    });

    it('rejects revoking an already-accepted invitation', async () => {
        const accepted = makeInvitation({ acceptedAt: new Date() });

        await expect(invitationService.revokeInvitation('org-1', accepted.id)).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });
});
