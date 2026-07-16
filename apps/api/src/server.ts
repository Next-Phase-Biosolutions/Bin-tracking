import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyRawBody from 'fastify-raw-body';
import {
    fastifyTRPCPlugin,
    type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { appRouter, type AppRouter } from './routers/index.js';
import { createContext } from './trpc/context.js';
import { registerStripeWebhook } from './routes/stripe-webhook.js';
import { initSentry, captureError } from './lib/sentry.js';
import { validateEnv } from './lib/env.js';

// Fail fast on a misconfigured production environment — before Sentry init,
// before the server binds. No-op outside production (lib/env.ts).
validateEnv();

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const IS_DEV = process.env['NODE_ENV'] !== 'production';

// Initialized before buildServer() so errors during startup are also
// reportable. No-ops when SENTRY_DSN is unset — see lib/sentry.ts.
initSentry();

async function buildServer() {
    const server = Fastify({
        logger: {
            level: process.env['LOG_LEVEL'] ?? (IS_DEV ? 'debug' : 'info'),
            transport: IS_DEV ? { target: 'pino-pretty' } : undefined,
        },
        maxParamLength: 256,
        bodyLimit: 20 * 1024 * 1024, // 20MB — audio recordings can be large
    });

    // ─── Security ────────────────────────────────────────────
    await server.register(helmet, {
        contentSecurityPolicy: false, // API server, not serving HTML
    });

    // ─── CORS ────────────────────────────────────────────────
    await server.register(cors, {
        origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
        credentials: true,
    });

    // ─── Rate Limiting ───────────────────────────────────────
    await server.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    // ─── Health Check (raw Fastify — no tRPC, no auth) ──────
    server.get('/health', async (_request, reply) => {
        return reply.status(200).send({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });

    // ─── Stripe webhook (raw body, registered before tRPC) ───
    await server.register(fastifyRawBody, {
        field: 'rawBody',
        global: false,
        runFirst: true,
    });
    await registerStripeWebhook(server);

    // ─── tRPC ────────────────────────────────────────────────
    await server.register(fastifyTRPCPlugin, {
        prefix: '/trpc',
        trpcOptions: {
            router: appRouter,
            createContext: ({ req }) => createContext(req),
            // Side-effect hook for error reporting — kept separate from
            // trpc.ts's errorFormatter (which only shapes the client-facing
            // response). `ctx` is available here (v11 HTTPErrorHandlerOptions),
            // so every captured event is tagged with the tenant it happened in.
            // Only genuine server bugs go to Sentry — expected client-facing
            // errors (validation, auth, not-found, etc.) are not bugs and
            // would otherwise burn Sentry's quota and bury real issues.
            onError({ error, ctx }) {
                if (error.code === 'INTERNAL_SERVER_ERROR') {
                    captureError(error, ctx?.orgId ?? null);
                }
            },
        } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
    });

    return server;
}

async function main(): Promise<void> {
    const server = await buildServer();

    // Graceful shutdown — `docker compose stop` (every blue-green flip) sends
    // SIGTERM; without this, in-flight requests are severed and the process is
    // SIGKILLed at the compose stop timeout. fastify.close() stops accepting
    // new connections and drains active ones. Requires the container CMD to
    // run node/tsx directly (see apps/api/Dockerfile) so the signal actually
    // reaches this process.
    // Never under vitest — the runner re-emits signals at teardown and a
    // process.exit() here would kill its worker mid-report.
    let shuttingDown = false;
    if (process.env['NODE_ENV'] !== 'test') {
        for (const signal of ['SIGTERM', 'SIGINT'] as const) {
            process.on(signal, () => {
                if (shuttingDown) return;
                shuttingDown = true;
                server.log.info(`${signal} received — draining connections and shutting down`);
                server.close().then(
                    () => process.exit(0),
                    (err) => {
                        server.log.error(err, 'error during graceful shutdown');
                        process.exit(1);
                    },
                );
            });
        }
    }

    try {
        const address = await server.listen({ port: PORT, host: HOST });
        server.log.info(`🚀 Server listening at ${address}`);
        server.log.info(`📋 Health: ${address}/health`);
        server.log.info(`🔌 tRPC: ${address}/trpc`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

void main();
