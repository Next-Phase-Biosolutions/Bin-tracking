import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerSensorIngest } from './sensor-ingest.js';

const { ingestMock } = vi.hoisted(() => ({ ingestMock: vi.fn() }));

vi.mock('../services/sensor-ingest.service.js', () => {
    // Local stand-in with the same name so the route's instanceof check and this
    // test resolve to the same class without loading the prisma client.
    class UnknownSensorDeviceError extends Error {}
    return { sensorIngestService: { ingest: ingestMock }, UnknownSensorDeviceError };
});

const KEY = 'test-ingest-key-0123456789abcdef0123';
const body = { p_device_id: 'master-01', p_raw: { battery_mv: 3712 }, p_temp_c: 24.6 };

describe('POST /ingest/sensor-reading', () => {
    let server: FastifyInstance;

    const post = (payload: unknown, headers: Record<string, string> = { apikey: KEY }) =>
        server.inject({
            method: 'POST',
            url: '/ingest/sensor-reading',
            payload: payload as object,
            headers: { 'content-type': 'application/json', ...headers },
        });

    beforeEach(async () => {
        ingestMock.mockReset().mockResolvedValue(undefined);
        process.env['SENSOR_INGEST_API_KEY'] = KEY;
        server = Fastify();
        await registerSensorIngest(server);
    });

    afterEach(async () => {
        await server.close();
    });

    it('returns 204 with no body for a valid reading and passes the parsed input on', async () => {
        const res = await post(body);
        expect(res.statusCode).toBe(204);
        expect(res.body).toBe('');
        expect(ingestMock).toHaveBeenCalledWith(expect.objectContaining({ p_device_id: 'master-01', p_temp_c: 24.6 }));
    });

    it('rejects a missing apikey header with 401 and stores nothing', async () => {
        const res = await post(body, {});
        expect(res.statusCode).toBe(401);
        expect(ingestMock).not.toHaveBeenCalled();
    });

    it('rejects a wrong apikey with 401', async () => {
        const res = await post(body, { apikey: 'nope' });
        expect(res.statusCode).toBe(401);
        expect(ingestMock).not.toHaveBeenCalled();
    });

    it('rejects a key that only shares a prefix with the real one', async () => {
        const res = await post(body, { apikey: KEY.slice(0, -1) });
        expect(res.statusCode).toBe(401);
    });

    it('fails closed when SENSOR_INGEST_API_KEY is unset, even for an empty apikey', async () => {
        delete process.env['SENSOR_INGEST_API_KEY'];
        const res = await post(body, { apikey: '' });
        expect(res.statusCode).toBe(401);
        expect(ingestMock).not.toHaveBeenCalled();
    });

    it('authenticates before validating the body (a bad key gets no schema hints)', async () => {
        const res = await post({ nonsense: true }, { apikey: 'nope' });
        expect(res.statusCode).toBe(401);
    });

    it('returns 400 naming the problem for an invalid body', async () => {
        const res = await post({ p_device_id: '', p_raw: {} });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toContain('p_device_id');
        expect(ingestMock).not.toHaveBeenCalled();
    });

    it('returns 404 for a device that is not registered', async () => {
        const { UnknownSensorDeviceError } = await import('../services/sensor-ingest.service.js');
        ingestMock.mockRejectedValueOnce(new UnknownSensorDeviceError('unknown device: ghost-99'));
        const res = await post({ ...body, p_device_id: 'ghost-99' });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown device');
    });

    it('returns a generic 500 that does not leak the underlying error text', async () => {
        ingestMock.mockRejectedValueOnce(new Error('Invalid `prisma.sensorReading.createMany()` invocation: secret-detail'));
        const res = await post(body);
        expect(res.statusCode).toBe(500);
        expect(res.body).not.toContain('prisma');
        expect(res.body).not.toContain('secret-detail');
        expect(res.json().error).toBe('internal error');
    });

    it('authenticates before parsing: a bad key with an unparseable body still gets 401', async () => {
        const res = await server.inject({
            method: 'POST',
            url: '/ingest/sensor-reading',
            payload: '{not json',
            headers: { 'content-type': 'application/json', apikey: 'nope' },
        });
        expect(res.statusCode).toBe(401);
    });

    it('rejects a body over the route limit with 413, even with a valid key', async () => {
        const res = await post({ ...body, p_raw: { blob: 'x'.repeat(40 * 1024) } });
        expect(res.statusCode).toBe(413);
        expect(ingestMock).not.toHaveBeenCalled();
    });
});
