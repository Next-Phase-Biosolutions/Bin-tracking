import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env['SUPABASE_URL']!;
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY']!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

/**
 * Server-side Supabase client for JWT verification.
 * Typed as `any` to avoid TypeScript's portable-type-naming restriction
 * on the deeply-nested internal Supabase type path.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseClient: any = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
        // Fastify doesn't use cookies for API — stub implementation
        get: () => undefined,
        set: () => {},
        remove: () => {},
    },
});
