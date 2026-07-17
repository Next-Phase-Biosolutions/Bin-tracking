import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignJWT } from 'jose';

// jwt.ts statically imports supabase.js, which throws without SUPABASE_URL/
// SUPABASE_ANON_KEY — stub it out; these tests only exercise the local
// (SUPABASE_JWT_SECRET) verification path plus fallback selection.
const getUserMock = vi.hoisted(() => vi.fn());
vi.mock('./supabase.js', () => ({ supabaseClient: { auth: { getUser: getUserMock } } }));

import { verifySupabaseToken } from './jwt.js';

const SECRET = 'test-jwt-secret-test-jwt-secret-test';

async function signToken(claims: Record<string, unknown>, secret = SECRET, expiresIn = '1h'): Promise<string> {
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(new TextEncoder().encode(secret));
}

describe('verifySupabaseToken — local HS256 verification (SUPABASE_JWT_SECRET set)', () => {
    beforeEach(() => {
        process.env['SUPABASE_JWT_SECRET'] = SECRET;
        getUserMock.mockReset();
    });
    afterEach(() => {
        delete process.env['SUPABASE_JWT_SECRET'];
    });

    it('returns sub/email/exp from a validly-signed token without any network call', async () => {
        const token = await signToken({ sub: 'user-1', email: 'a@example.com' });
        const payload = await verifySupabaseToken(token);
        expect(payload).toMatchObject({ sub: 'user-1', email: 'a@example.com' });
        expect(payload?.exp).toBeTypeOf('number');
        expect(getUserMock).not.toHaveBeenCalled();
    });

    it('rejects a token signed with a different secret', async () => {
        const token = await signToken({ sub: 'user-1' }, 'wrong-secret-wrong-secret-wrong-secr');
        expect(await verifySupabaseToken(token)).toBeNull();
    });

    it('rejects an expired token', async () => {
        const token = await signToken({ sub: 'user-1' }, SECRET, '-1h');
        expect(await verifySupabaseToken(token)).toBeNull();
    });

    it('rejects a token with no sub claim', async () => {
        const token = await signToken({ email: 'a@example.com' });
        expect(await verifySupabaseToken(token)).toBeNull();
    });

    it('rejects garbage input', async () => {
        expect(await verifySupabaseToken('not-a-jwt')).toBeNull();
    });
});

describe('verifySupabaseToken — network fallback (no SUPABASE_JWT_SECRET)', () => {
    beforeEach(() => {
        delete process.env['SUPABASE_JWT_SECRET'];
        getUserMock.mockReset();
    });

    it('falls back to supabase auth.getUser', async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: 'user-2', email: 'b@example.com', user_metadata: {} } }, error: null });
        const payload = await verifySupabaseToken('opaque-token');
        expect(payload).toMatchObject({ sub: 'user-2', email: 'b@example.com' });
        expect(getUserMock).toHaveBeenCalledWith('opaque-token');
    });

    it('returns null when supabase rejects the token', async () => {
        getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
        expect(await verifySupabaseToken('bad-token')).toBeNull();
    });
});

describe('verifySupabaseToken — asymmetric tokens (ES256) verified via JWKS', () => {
    const realFetch = globalThis.fetch;
    let publicJwk: Record<string, unknown>;
    let privateKey: Awaited<ReturnType<typeof import('jose').generateKeyPair>>['privateKey'];

    beforeEach(async () => {
        // Even with the shared secret set (as in production), ES256 tokens
        // must route to JWKS — this is the exact prod-incident scenario.
        process.env['SUPABASE_JWT_SECRET'] = SECRET;
        process.env['SUPABASE_URL'] = 'https://test-project.supabase.co';
        getUserMock.mockReset();

        const { generateKeyPair, exportJWK } = await import('jose');
        const pair = await generateKeyPair('ES256');
        privateKey = pair.privateKey;
        publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-kid', alg: 'ES256', use: 'sig' };

        globalThis.fetch = vi.fn(async () =>
            new Response(JSON.stringify({ keys: [publicJwk] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        ) as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
        delete process.env['SUPABASE_JWT_SECRET'];
        delete process.env['SUPABASE_URL'];
    });

    async function signEs256(claims: Record<string, unknown>, expiresIn = '1h'): Promise<string> {
        return new SignJWT(claims)
            .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
            .setIssuedAt()
            .setExpirationTime(expiresIn)
            .sign(privateKey);
    }

    it('verifies a valid ES256 token against the project JWKS, not the shared secret', async () => {
        const token = await signEs256({ sub: 'user-3', email: 'c@example.com' });
        const payload = await verifySupabaseToken(token);
        expect(payload).toMatchObject({ sub: 'user-3', email: 'c@example.com' });
        expect(getUserMock).not.toHaveBeenCalled();
        expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('rejects an ES256 token signed by a different key', async () => {
        const { generateKeyPair } = await import('jose');
        const rogue = await generateKeyPair('ES256');
        const token = await new SignJWT({ sub: 'user-3' })
            .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(rogue.privateKey);
        expect(await verifySupabaseToken(token)).toBeNull();
    });

    it('rejects an expired ES256 token', async () => {
        const token = await signEs256({ sub: 'user-3' }, '-1h');
        expect(await verifySupabaseToken(token)).toBeNull();
    });
});
