import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { TRPCError } from '@trpc/server';

// server.ts boots a real Fastify app and fires `main()` (which calls
// `server.listen(...)`) as a side effect of module import — see the bottom
// of server.ts. To capture the tRPC plugin's `onError` handler without
// opening a real network listener, replace `fastify` with a lightweight
// fake whose `register` just records calls instead of invoking plugin
// bodies, and stub out the heavy dependency chain (appRouter/createContext/
// stripe webhook) that this test never needs to exercise.
const sentryMock = vi.hoisted(() => ({
    initSentry: vi.fn(),
    captureError: vi.fn(),
}));
vi.mock('./lib/sentry.js', () => sentryMock);

const fastifyTRPCPluginMock = vi.hoisted(() => vi.fn());
vi.mock('@trpc/server/adapters/fastify', () => ({
    fastifyTRPCPlugin: fastifyTRPCPluginMock,
}));

vi.mock('./routers/index.js', () => ({ appRouter: {} }));
vi.mock('./trpc/context.js', () => ({ createContext: vi.fn() }));
vi.mock('./routes/stripe-webhook.js', () => ({ registerStripeWebhook: vi.fn(async () => {}) }));

const fakeApp = vi.hoisted(() => ({
    register: vi.fn(async (..._args: unknown[]) => {}),
    get: vi.fn(),
    route: vi.fn(),
    listen: vi.fn(async () => 'http://localhost:3001'),
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('fastify', () => ({ default: vi.fn(() => fakeApp) }));

interface OnErrorArgs {
    error: TRPCError;
    ctx?: { orgId: string | null } | null;
}
type RegisterCall = [unknown, { trpcOptions?: { onError?: (args: OnErrorArgs) => void } }];

function getTrpcOnError(): (args: OnErrorArgs) => void {
    const calls = fakeApp.register.mock.calls as unknown as RegisterCall[];
    const call = calls.find(([plugin]) => plugin === fastifyTRPCPluginMock);
    const onError = call?.[1].trpcOptions?.onError;
    if (!onError) throw new Error('tRPC plugin onError was never registered');
    return onError;
}

describe('tRPC onError -> Sentry filter', () => {
    beforeAll(async () => {
        await import('./server.js');
        // buildServer()'s plugin registrations happen asynchronously after
        // module evaluation finishes (main() is fire-and-forget) — wait
        // until the tRPC plugin registration lands before asserting on it.
        await vi.waitFor(() => {
            const registered = fakeApp.register.mock.calls.some(([plugin]) => plugin === fastifyTRPCPluginMock);
            if (!registered) throw new Error('tRPC plugin not registered yet');
        });
    });

    it('does not forward expected client errors (e.g. BAD_REQUEST) to Sentry', () => {
        const onError = getTrpcOnError();
        const error = { code: 'BAD_REQUEST', message: 'invalid input' } as TRPCError;

        onError({ error, ctx: { orgId: 'org-1' } });

        expect(sentryMock.captureError).not.toHaveBeenCalled();
    });

    it('does not forward NOT_FOUND, UNAUTHORIZED, or FORBIDDEN errors to Sentry', () => {
        const onError = getTrpcOnError();

        for (const code of ['NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN'] as const) {
            onError({ error: { code, message: code } as TRPCError, ctx: { orgId: 'org-1' } });
        }

        expect(sentryMock.captureError).not.toHaveBeenCalled();
    });

    it('forwards genuine server bugs (INTERNAL_SERVER_ERROR) to Sentry, tagged with orgId', () => {
        const onError = getTrpcOnError();
        const error = { code: 'INTERNAL_SERVER_ERROR', message: 'boom' } as TRPCError;

        onError({ error, ctx: { orgId: 'org-1' } });

        expect(sentryMock.captureError).toHaveBeenCalledWith(error, 'org-1');
    });
});
