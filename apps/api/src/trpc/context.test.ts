import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest } from 'fastify';

// ─── Mocks ──────────────────────────────────────────────────────

// Mutable, per-test-controllable: lets the Bearer-branch tests below choose
// whether prisma.user.findUnique resolves an existing User row or null,
// without a separate vi.mock per test (vi.mock bodies are hoisted once per file).
const userStore = vi.hoisted(() => ({ byId: null as { id: string; email: string; role: string } | null }));

// Task 25: mutable per-test-controllable OrganizationMember row, so tests can
// prove ctx.orgRole is resolved from THIS (the membership row), independently
// of — and possibly differing from — userStore.byId.role (the global role).
const membershipStore = vi.hoisted(() => ({
    byUserId: null as { orgId: string; role: string } | null,
}));

vi.mock('@bin-tracker/db', () => ({
    prisma: {
        user: {
            findUnique: () => Promise.resolve(userStore.byId),
            findFirst: () => Promise.resolve(null),
        },
        // Org resolution runs at the end of createContext for every request.
        organizationMember: {
            findFirst: () => Promise.resolve(membershipStore.byUserId),
        },
    },
}));

// isAuthDisabled defaults to false with no env vars set, but pin it
// explicitly so this test doesn't depend on ambient env state.
vi.mock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => false }));

// context.ts statically imports jwt.ts, which in turn imports the real
// Supabase client and throws at module-load time without SUPABASE_URL /
// SUPABASE_ANON_KEY. Stub it out to avoid needing real Supabase env vars.
// Mutable so the Bearer-branch tests below can resolve a real payload.
const jwtStore = vi.hoisted(() => ({
    payload: null as { sub: string; email?: string } | null,
}));

vi.mock('../lib/jwt.js', () => ({ verifySupabaseToken: () => Promise.resolve(jwtStore.payload) }));

const { createContext } = await import('./context.js');

function fakeRequest(authorization?: string): FastifyRequest {
    const childLog = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    return {
        headers: authorization ? { authorization } : {},
        log: { warn: vi.fn(), child: vi.fn(() => childLog) },
    } as unknown as FastifyRequest;
}

beforeEach(() => {
    userStore.byId = null;
    jwtStore.payload = null;
    membershipStore.byUserId = null;
});

// This is the load-bearing wiring for Task 18's trust-boundary fix:
// verifySupabaseToken succeeding must set ctx.jwtPayload even when no local
// User row exists yet (a brand-new Supabase signup), so auth.bootstrap can
// run via verifiedProcedure before the User row is created. Before this
// task, jwtPayload didn't exist on Context at all — a reverted context.ts
// would fail every assertion below (ctx.jwtPayload would be undefined).
describe('createContext — Bearer JWT: jwtPayload vs. user wiring', () => {
    it('sets ctx.jwtPayload from a valid JWT even when no local User row exists', async () => {
        jwtStore.payload = { sub: 'supabase-user-1', email: 'new@example.com' };
        userStore.byId = null; // no local User row yet — the exact signup scenario

        const ctx = await createContext(fakeRequest('Bearer valid-token'));

        expect(ctx.jwtPayload).toEqual({ sub: 'supabase-user-1', email: 'new@example.com' });
        expect(ctx.user).toBeNull();
    });

    it('sets both ctx.jwtPayload and ctx.user when a matching User row exists', async () => {
        jwtStore.payload = { sub: 'supabase-user-2', email: 'existing@example.com' };
        userStore.byId = { id: 'supabase-user-2', email: 'existing@example.com', role: 'ADMIN' };

        const ctx = await createContext(fakeRequest('Bearer valid-token'));

        expect(ctx.jwtPayload).toEqual({ sub: 'supabase-user-2', email: 'existing@example.com' });
        expect(ctx.user?.id).toBe('supabase-user-2');
    });

    it('leaves both jwtPayload and user null when the token fails verification', async () => {
        jwtStore.payload = null;

        const ctx = await createContext(fakeRequest('Bearer invalid-token'));

        expect(ctx.jwtPayload).toBeNull();
        expect(ctx.user).toBeNull();
    });
});

// Task 25: ctx.orgRole must come from the caller's OrganizationMember row,
// never from ctx.user.role — this is the wiring that closes the invitation
// privilege-escalation hole at the context layer.
describe('createContext — Bearer JWT: ctx.orgRole from membership, not global role', () => {
    it('resolves ctx.orgRole from the membership row even when it differs from the global user.role', async () => {
        jwtStore.payload = { sub: 'supabase-user-3', email: 'existing@example.com' };
        // Global role is ADMIN (e.g. from bootstrap on an unrelated org)...
        userStore.byId = { id: 'supabase-user-3', email: 'existing@example.com', role: 'ADMIN' };
        // ...but this account's membership in the org it's actually acting on
        // is a restricted DRIVER role.
        membershipStore.byUserId = { orgId: 'org-9', role: 'DRIVER' };

        const ctx = await createContext(fakeRequest('Bearer valid-token'));

        expect(ctx.user?.role).toBe('ADMIN');
        expect(ctx.orgRole).toBe('DRIVER');
        expect(ctx.orgRole).not.toBe(ctx.user?.role);
    });

    it('sets ctx.orgRole to null when the user has no membership', async () => {
        jwtStore.payload = { sub: 'supabase-user-4', email: 'noorg@example.com' };
        userStore.byId = { id: 'supabase-user-4', email: 'noorg@example.com', role: 'ADMIN' };
        membershipStore.byUserId = null;

        const ctx = await createContext(fakeRequest('Bearer valid-token'));

        expect(ctx.orgId).toBeNull();
        expect(ctx.orgRole).toBeNull();
    });
});

// Task 21: request log context should carry orgId once resolved, so
// per-tenant log filtering works without threading orgId through every
// call site. See context.ts's `req.log = req.log.child({ orgId })`.
describe('createContext — request log enrichment with orgId', () => {
    it('childs the request logger with orgId once an org resolves', async () => {
        jwtStore.payload = { sub: 'supabase-user-5', email: 'member@example.com' };
        userStore.byId = { id: 'supabase-user-5', email: 'member@example.com', role: 'WORKER' };
        membershipStore.byUserId = { orgId: 'org-1', role: 'WORKER' };

        const req = fakeRequest('Bearer valid-token');
        // createContext reassigns req.log to the child logger it returns, so
        // the original logger (and its `child` spy) must be captured first.
        const originalLog = req.log;

        const ctx = await createContext(req);

        expect(ctx.orgId).toBe('org-1');
        expect(vi.mocked(originalLog.child)).toHaveBeenCalledWith({ orgId: 'org-1' });
    });

    it('does not child the request logger when no org resolves', async () => {
        const req = fakeRequest();
        const originalLog = req.log;

        const ctx = await createContext(req);

        expect(ctx.orgId).toBeNull();
        expect(vi.mocked(originalLog.child)).not.toHaveBeenCalled();
    });
});
