import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose';
import { supabaseClient } from './supabase.js';

export interface JWTPayload {
    sub: string; // user ID
    email?: string;
    role?: string;
    iat?: number;
    exp?: number;
}

/**
 * Verify a Supabase JWT and extract user claims.
 * Returns the decoded payload, or null if the token is invalid/expired.
 *
 * When SUPABASE_JWT_SECRET is set (required in production — see
 * lib/env.ts), verification is LOCAL (HS256 via jose): no network call, so
 * per-request latency doesn't include a Supabase Auth round-trip and a
 * Supabase Auth outage or rate limit can't take the whole API down. Without
 * the secret (local dev convenience), falls back to Supabase's networked
 * `auth.getUser`, which is also the escape hatch if a project migrates to
 * asymmetric signing keys where the shared secret no longer applies.
 */
export async function verifySupabaseToken(token: string): Promise<JWTPayload | null> {
    // Asymmetric tokens (Supabase's newer JWT signing keys, e.g. ES256) can
    // never validate against the shared secret — verify them against the
    // project's public JWKS instead. Still local-ish: jose caches the key
    // set, so steady-state requests make no network call. Undecodable
    // tokens skip this branch and fail through the legacy paths below.
    const alg = tokenAlg(token);
    if (alg && alg !== 'HS256') {
        const jwks = getJwks();
        if (jwks) return verifyWithJwks(token, jwks);
        return verifyViaSupabase(token);
    }

    const secret = process.env['SUPABASE_JWT_SECRET'];
    if (secret) {
        return verifyLocally(token, secret);
    }
    return verifyViaSupabase(token);
}

function tokenAlg(token: string): string | null {
    try {
        return decodeProtectedHeader(token).alg ?? null;
    } catch {
        return null;
    }
}

// Cached per process; keyed by URL so a changed SUPABASE_URL (tests) rebuilds it.
let jwksCache: { url: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
    const supabaseUrl = process.env['SUPABASE_URL'];
    if (!supabaseUrl) return null;
    const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
    if (jwksCache?.url !== url) {
        jwksCache = { url, jwks: createRemoteJWKSet(new URL(url)) };
    }
    return jwksCache.jwks;
}

async function verifyWithJwks(token: string, jwks: ReturnType<typeof createRemoteJWKSet>): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, jwks);
        return toClaims(payload);
    } catch {
        return null;
    }
}

async function verifyLocally(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ['HS256'],
        });
        return toClaims(payload);
    } catch {
        return null; // bad signature, expired, malformed — all just "not authenticated"
    }
}

function toClaims(payload: JoseJWTPayload): JWTPayload | null {
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return {
        sub: payload.sub,
        email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
        role: typeof payload['role'] === 'string' ? payload['role'] : undefined,
        iat: payload.iat,
        exp: payload.exp,
    };
}

async function verifyViaSupabase(token: string): Promise<JWTPayload | null> {
    try {
        const {
            data: { user },
            error,
        } = await supabaseClient.auth.getUser(token);

        if (error || !user) {
            return null;
        }

        return {
            sub: user.id,
            email: user.email,
            role: user.user_metadata?.role,
        };
    } catch {
        return null;
    }
}
