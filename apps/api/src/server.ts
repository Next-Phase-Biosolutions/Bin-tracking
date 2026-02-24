import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
    fastifyTRPCPlugin,
    type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { appRouter, type AppRouter } from './routers/index.js';
import { createContext } from './trpc/context.js';

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const IS_DEV = process.env['NODE_ENV'] !== 'production';

async function buildServer() {
    const server = Fastify({
        logger: {
            level: process.env['LOG_LEVEL'] ?? (IS_DEV ? 'debug' : 'info'),
            transport: IS_DEV ? { target: 'pino-pretty' } : undefined,
        },
        maxParamLength: 256,
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

    // ─── tRPC ────────────────────────────────────────────────
    await server.register(fastifyTRPCPlugin, {
        prefix: '/trpc',
        trpcOptions: {
            router: appRouter,
            createContext: ({ req }) => createContext(req),
        } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
    });

    return server;
}

async function main(): Promise<void> {
    const server = await buildServer();

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
