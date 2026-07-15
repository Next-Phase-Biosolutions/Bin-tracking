import { z } from 'zod';

/**
 * Boot-time env validation. Optional integrations (Stripe, Resend, Sentry,
 * Redis) stay lazy — missing config for those must never crash boot (see
 * their lib/*.ts singletons). But config the API cannot serve real traffic
 * without should fail LOUDLY at startup in production, not as runtime 500s
 * hours after a misconfigured deploy: an instant crash gets caught by the
 * blue-green health check and the old color stays live.
 */
const productionEnvSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a URL'),
    SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
    SUPABASE_JWT_SECRET: z.string().min(1, 'SUPABASE_JWT_SECRET is required — JWTs are verified locally in production'),
    CORS_ORIGIN: z.string().url('CORS_ORIGIN must be the web app origin'),
    APP_URL: z.string().url('APP_URL must be the web app URL'),
});

/**
 * Call once at process start. Throws (crashing boot) in production when a
 * required variable is missing/malformed; no-ops outside production so local
 * dev and tests keep their lenient, lazy-failure behavior.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
    if (env['NODE_ENV'] !== 'production') return;

    const result = productionEnvSchema.safeParse(env);
    if (!result.success) {
        const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Refusing to start: invalid production environment:\n${problems}`);
    }

    if (env['DISABLE_AUTH'] === 'true') {
        // auth-flags.ts already hard-disables the bypass in production, but a
        // production env that ASKS for it is a misconfiguration worth failing
        // over, not silently ignoring.
        throw new Error('Refusing to start: DISABLE_AUTH=true must never be set in production');
    }
}
