import { jwtVerify } from 'jose';
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
    const secret = process.env['SUPABASE_JWT_SECRET'];
    if (secret) {
        return verifyLocally(token, secret);
    }
    return verifyViaSupabase(token);
}

async function verifyLocally(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ['HS256'],
        });
        if (typeof payload.sub !== 'string' || !payload.sub) return null;
        return {
            sub: payload.sub,
            email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
            role: typeof payload['role'] === 'string' ? payload['role'] : undefined,
            iat: payload.iat,
            exp: payload.exp,
        };
    } catch {
        return null; // bad signature, expired, malformed — all just "not authenticated"
    }
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
