import * as Sentry from '@sentry/node';

let _initialized = false;

/**
 * Initializes Sentry error tracking. Deliberately does NOT throw or block
 * boot when SENTRY_DSN is unset — same boot-safety philosophy as
 * lib/stripe.ts's getStripe(): missing config must never crash the server,
 * only mean the feature stays inactive. Call once, before buildServer() runs.
 */
export function initSentry(): void {
    const dsn = process.env['SENTRY_DSN'];
    if (!dsn) return;
    Sentry.init({
        dsn,
        environment: process.env['NODE_ENV'] ?? 'development',
        /**
         * Never ship request BODIES to Sentry. The default
         * requestDataIntegration attaches them, and the SDK auto-instruments
         * Fastify — so an error thrown anywhere in a handler would carry that
         * request's payload offsite. This codebase routes employee bank
         * details (R7), voice transcripts and form submissions through those
         * handlers; a stack trace is worth having, the payload is not.
         *
         * Headers stay off too — they carry the Authorization bearer token.
         */
        integrations: [
            Sentry.requestDataIntegration({
                include: { data: false, headers: false, cookies: false },
            }),
        ],
    });
    _initialized = true;
}

/**
 * Captures an error to Sentry, tagged with the org it happened under so
 * events can be filtered per-tenant. `orgId` is null for requests that never
 * resolved a tenant (e.g. failed auth, platform-admin routes). No-ops when
 * Sentry was never initialized (SENTRY_DSN unset) — mirrors the rest of this
 * codebase's lazy, env-gated integrations.
 */
export function captureError(error: unknown, orgId: string | null): void {
    if (!_initialized) return;
    Sentry.captureException(error, { tags: { orgId: orgId ?? 'none' } });
}
