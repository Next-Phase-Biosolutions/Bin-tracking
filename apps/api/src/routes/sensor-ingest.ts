import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ingestSensorReadingSchema } from '@bin-tracker/validators';
import { sensorIngestService, UnknownSensorDeviceError } from '../services/sensor-ingest.service.js';
import { captureError } from '../lib/sentry.js';

// Devices share one key and often one NAT'd IP, so the global 100/min per-IP
// limit would throttle a healthy fleet. Higher ceiling here, still bounded.
const INGEST_RATE_LIMIT = { max: 600, timeWindow: '1 minute' };

// The server-wide bodyLimit is 20 MB (audio uploads). A reading is a few hundred
// bytes plus a <10 KB p_raw, so this route takes far less.
const INGEST_BODY_LIMIT_BYTES = 32 * 1024;

/** Constant-time compare. Hashing first equalizes lengths so a length mismatch can't leak via timing. */
function keysMatch(provided: string, expected: string): boolean {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
}

/**
 * Device push endpoint. Request shape mirrors the firmware handoff doc
 * (sensor-integration-testing): `apikey` header, `p_`-prefixed JSON body, 204 on
 * success. One shared key authenticates the whole fleet; the tenant comes from
 * the pre-registered SensorDevice, never from the payload.
 */
export async function registerSensorIngest(server: FastifyInstance): Promise<void> {
    server.route({
        method: 'POST',
        url: '/ingest/sensor-reading',
        bodyLimit: INGEST_BODY_LIMIT_BYTES,
        config: { rateLimit: INGEST_RATE_LIMIT },
        // onRequest runs before the body is read, so an unauthenticated caller
        // costs us one header compare, not a JSON parse.
        onRequest: async (req, reply) => {
            const expected = process.env['SENSOR_INGEST_API_KEY'];
            const provided = req.headers['apikey'];
            // Fail closed: an unset server key must never match an empty/missing header.
            if (!expected || typeof provided !== 'string' || !keysMatch(provided, expected)) {
                return reply.status(401).send({ error: 'invalid api key' });
            }
        },
        handler: async (req, reply) => {
            const parsed = ingestSensorReadingSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
                return reply.status(400).send({ error: message });
            }

            try {
                await sensorIngestService.ingest(parsed.data);
            } catch (err) {
                if (err instanceof UnknownSensorDeviceError) {
                    req.log.warn({ deviceId: parsed.data.p_device_id }, 'sensor ingest: unregistered device rejected');
                    return reply.status(404).send({ error: 'unknown device' });
                }
                // Fastify's default 500 body echoes err.message, which for Prisma
                // errors includes query detail. Log it, return nothing useful.
                req.log.error({ err }, 'sensor ingest: unexpected failure');
                captureError(err instanceof Error ? err : new Error(String(err)), null);
                return reply.status(500).send({ error: 'internal error' });
            }
            return reply.status(204).send();
        },
    });
}
