import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// initSentry/captureError share module-level `_initialized` state, so each
// case needs a fresh module instance (vi.resetModules + dynamic import) —
// same pattern as stripe.test.ts's PLAN_BY_PRICE cases.
const originalDsn = process.env['SENTRY_DSN'];

const sentryMock = vi.hoisted(() => ({
    init: vi.fn(),
    captureException: vi.fn(),
    // Returns its config so the test can assert what initSentry asked for.
    requestDataIntegration: vi.fn((options: unknown) => ({ name: 'RequestData', options })),
}));

vi.mock('@sentry/node', () => ({
    init: sentryMock.init,
    captureException: sentryMock.captureException,
    requestDataIntegration: sentryMock.requestDataIntegration,
}));

beforeEach(() => {
    sentryMock.init.mockClear();
    sentryMock.captureException.mockClear();
    sentryMock.requestDataIntegration.mockClear();
});

afterEach(() => {
    if (originalDsn === undefined) delete process.env['SENTRY_DSN'];
    else process.env['SENTRY_DSN'] = originalDsn;
});

describe('initSentry', () => {
    it('does not call Sentry.init when SENTRY_DSN is unset', async () => {
        delete process.env['SENTRY_DSN'];
        vi.resetModules();
        const { initSentry } = await import('./sentry.js');

        initSentry();

        expect(sentryMock.init).not.toHaveBeenCalled();
    });

    it('calls Sentry.init with the configured DSN when SENTRY_DSN is set', async () => {
        process.env['SENTRY_DSN'] = 'https://example@o0.ingest.sentry.io/1';
        vi.resetModules();
        const { initSentry } = await import('./sentry.js');

        initSentry();

        expect(sentryMock.init).toHaveBeenCalledWith(
            expect.objectContaining({ dsn: 'https://example@o0.ingest.sentry.io/1' }),
        );
    });

    it('never ships request bodies, headers or cookies to Sentry', async () => {
        // Not a style preference — the default requestDataIntegration attaches
        // request bodies, and these handlers carry employee bank details (R7),
        // voice transcripts and Authorization bearer tokens. If this assertion
        // ever fails, PII is leaving the building.
        process.env['SENTRY_DSN'] = 'https://example@o0.ingest.sentry.io/1';
        vi.resetModules();
        const { initSentry } = await import('./sentry.js');

        initSentry();

        expect(sentryMock.requestDataIntegration).toHaveBeenCalledWith({
            include: { data: false, headers: false, cookies: false },
        });
    });
});

describe('captureError', () => {
    it('does not call Sentry.captureException when Sentry was never initialized', async () => {
        delete process.env['SENTRY_DSN'];
        vi.resetModules();
        const { captureError } = await import('./sentry.js');

        captureError(new Error('boom'), 'org-1');

        expect(sentryMock.captureException).not.toHaveBeenCalled();
    });

    it('tags the captured event with orgId once initialized', async () => {
        process.env['SENTRY_DSN'] = 'https://example@o0.ingest.sentry.io/1';
        vi.resetModules();
        const { initSentry, captureError } = await import('./sentry.js');
        initSentry();

        const error = new Error('boom');
        captureError(error, 'org-1');

        expect(sentryMock.captureException).toHaveBeenCalledWith(error, { tags: { orgId: 'org-1' } });
    });

    it('tags the captured event with "none" when no org resolved for the request', async () => {
        process.env['SENTRY_DSN'] = 'https://example@o0.ingest.sentry.io/1';
        vi.resetModules();
        const { initSentry, captureError } = await import('./sentry.js');
        initSentry();

        const error = new Error('boom');
        captureError(error, null);

        expect(sentryMock.captureException).toHaveBeenCalledWith(error, { tags: { orgId: 'none' } });
    });
});
