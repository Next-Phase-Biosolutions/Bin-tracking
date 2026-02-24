import { supabaseClient } from './supabase.js';

export interface JWTPayload {
    sub: string; // user ID
    email?: string;
    role?: string;
    iat: number;
    exp: number;
}

/**
 * Verify Supabase JWT token and extract user claims
 * Returns decoded payload or null if token is invalid/expired
 */
export async function verifySupabaseToken(token: string): Promise<JWTPayload | null> {
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
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600, // Supabase default: 1 hour
        };
    } catch {
        return null;
    }
}
