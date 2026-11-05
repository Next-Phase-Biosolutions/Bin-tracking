import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { isPhoneRoute, rateLimitKey, rateLimitMax, rateLimitOptions } from './rate-limit-config.js';

afterEach(() => vi.unstubAllEnvs());

const req = (url: string, ip = '10.0.0.1', headers: Record<string, string> = {}) => ({ url, ip, headers });

describe('isPhoneRoute', () => {
    it.each(['/trpc/attendance.tap', '/trpc/attendance.tap?batch=1&input=%7B%7D', '/trpc/deviceRegistration.start?batch=1', '/trpc/attendance.tap,deviceRegistration.start?batch=1'])(
        'is true for %s',
        (url) => expect(isPhoneRoute(url)).toBe(true),
    );

    it.each([
        '/trpc/payroll.computeRun',
        '/trpc/attendance.scan',
        '/trpc/attendance.facilityStatus',
        '/trpc/attendance.tap,payroll.computeRun?batch=1', // a mixed batch cannot borrow the phone bucket
        '/trpc/attendance.tapx',
        '/trpc/',
        '/trpc',
        '/health',
        '/other/attendance.tap',
    ])('is false for %s', (url) => expect(isPhoneRoute(url)).toBe(false));

    it('is false for an unparseable URL instead of throwing', () => {
        expect(isPhoneRoute('http://[bad')).toBe(false);
    });
});

describe('rateLimitKey and rateLimitMax', () => {
    it('gives phone routes their own namespace so they never count against the API bucket', () => {
        expect(rateLimitKey(req('/trpc/attendance.tap'))).toBe('phone:10.0.0.1');
        expect(rateLimitKey(req('/trpc/payroll.getRun'))).toBe('10.0.0.1');
    });

    it('uses CLIENT_IP_HEADER for both when configured', () => {
        vi.stubEnv('CLIENT_IP_HEADER', 'x-nf-client-connection-ip');
        const headers = { 'x-nf-client-connection-ip': '203.0.113.7' };
        expect(rateLimitKey(req('/trpc/attendance.tap', '10.0.0.1', headers))).toBe('phone:203.0.113.7');
        expect(rateLimitKey(req('/trpc/payroll.getRun', '10.0.0.1', headers))).toBe('203.0.113.7');
    });

    it('defaults: 100/min for the API, 3000/min for the phone routes', () => {
        expect(rateLimitMax(req('/trpc/payroll.getRun'))).toBe(100);
        expect(rateLimitMax(req('/trpc/attendance.tap'))).toBe(3000);
    });

    it('both ceilings are configurable, and a bad value falls back to the default', () => {
        vi.stubEnv('RATE_LIMIT_MAX', '250');
        vi.stubEnv('NFC_RATE_LIMIT_MAX', '9000');
        expect(rateLimitMax(req('/trpc/payroll.getRun'))).toBe(250);
        expect(rateLimitMax(req('/trpc/deviceRegistration.start'))).toBe(9000);
        vi.stubEnv('RATE_LIMIT_MAX', 'lots');
        vi.stubEnv('NFC_RATE_LIMIT_MAX', '-5');
        expect(rateLimitMax(req('/trpc/payroll.getRun'))).toBe(100);
        expect(rateLimitMax(req('/trpc/attendance.tap'))).toBe(3000);
    });
});

describe('the real limiter plugin with these options (a whole company behind one proxy address)', () => {
    async function server() {
        const app = Fastify();
        await app.register(rateLimit, rateLimitOptions());
        app.post('/trpc/attendance.tap', async () => ({ ok: true }));
        app.get('/trpc/payroll.getRun', async () => ({ ok: true }));
        return app;
    }
    type App = Awaited<ReturnType<typeof server>>;
    const post = (app: App) => app.inject({ method: 'POST', url: '/trpc/attendance.tap', remoteAddress: '10.9.9.9' });
    const get = (app: App) => app.inject({ method: 'GET', url: '/trpc/payroll.getRun', remoteAddress: '10.9.9.9' });
    // One request per event-loop turn, like real HTTP traffic. (Firing them all in one tick with Promise.all
    // makes the plugin's local store hand every request the same, final counter value: a test artifact.)
    async function repeat(n: number, call: () => ReturnType<typeof post>) {
        const statuses: number[] = [];
        for (let i = 0; i < n; i++) statuses.push((await call()).statusCode);
        return statuses;
    }

    it('lets 500 phone taps through in a minute from one address (the case that used to refuse the 101st)', async () => {
        const app = await server();
        const statuses = await repeat(500, () => post(app));
        expect(statuses.every((s) => s === 200)).toBe(true);
        await app.close();
    });

    it('still bounds a flood: the phone bucket ends at its ceiling', async () => {
        vi.stubEnv('NFC_RATE_LIMIT_MAX', '50');
        const app = await server();
        const statuses = await repeat(80, () => post(app));
        expect(statuses.filter((s) => s === 200)).toHaveLength(50);
        expect(statuses.filter((s) => s === 429)).toHaveLength(30);
        await app.close();
    });

    it('keeps the strict default for everything else, and phone traffic does not spend it', async () => {
        const app = await server();
        await repeat(400, () => post(app)); // heavy phone traffic first
        const api = await repeat(120, () => get(app));
        expect(api.filter((s) => s === 200)).toHaveLength(100);
        expect(api.filter((s) => s === 429)).toHaveLength(20);
        await app.close();
    });

    it('the refusal is HTTP 429 with the limiter\'s own (non-tRPC) body: the client must classify it by status', async () => {
        vi.stubEnv('NFC_RATE_LIMIT_MAX', '1');
        const app = await server();
        await post(app);
        const refused = await post(app);
        expect(refused.statusCode).toBe(429);
        expect(refused.json()).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
        await app.close();
    });
});
