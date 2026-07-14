import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';

// ─── Mocks ──────────────────────────────────────────────────────
// Station lookup is the only path exercised here, so a minimal
// prisma.station fake is enough (mirrors attendance.service.test.ts style).

interface FakeStation {
    id: string;
    token: string;
    revokedAt: Date | null;
    facility: { id: string; name: string };
}

const stations: FakeStation[] = [
    { id: 'st-active', token: 'token-active', revokedAt: null, facility: { id: 'f1', name: 'Facility 1' } },
    { id: 'st-revoked', token: 'token-revoked', revokedAt: new Date('2020-01-01'), facility: { id: 'f1', name: 'Facility 1' } },
];

vi.mock('@bin-tracker/db', () => ({
    prisma: {
        station: {
            findUnique: ({ where }: { where: { token: string } }) =>
                Promise.resolve(stations.find((s) => s.token === where.token) ?? null),
        },
        user: {
            findUnique: () => Promise.resolve(null),
            findFirst: () => Promise.resolve(null),
        },
        // Org resolution runs at the end of createContext for every request;
        // these are exercised (station branch) but resolve to "no org" here.
        organizationMember: {
            findFirst: () => Promise.resolve(null),
        },
        facility: {
            findUnique: () => Promise.resolve(null),
        },
    },
}));

// isAuthDisabled defaults to false with no env vars set, but pin it
// explicitly so this test doesn't depend on ambient env state.
vi.mock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => false }));

// context.ts statically imports jwt.ts, which in turn imports the real
// Supabase client and throws at module-load time without SUPABASE_URL /
// SUPABASE_ANON_KEY. This test never exercises the Bearer-token branch,
// so stub it out to avoid needing real Supabase env vars.
vi.mock('../lib/jwt.js', () => ({ verifySupabaseToken: () => Promise.resolve(null) }));

const { createContext } = await import('./context.js');

function fakeRequest(authorization?: string): FastifyRequest {
    return {
        headers: authorization ? { authorization } : {},
        log: { warn: vi.fn() },
    } as unknown as FastifyRequest;
}

describe('createContext — station token revocation', () => {
    it('resolves station to null for a revoked station token', async () => {
        const ctx = await createContext(fakeRequest('Station token-revoked'));
        expect(ctx.station).toBeNull();
    });

    it('resolves station to the record for a non-revoked station token', async () => {
        const ctx = await createContext(fakeRequest('Station token-active'));
        expect(ctx.station).not.toBeNull();
        expect(ctx.station?.id).toBe('st-active');
    });
});
