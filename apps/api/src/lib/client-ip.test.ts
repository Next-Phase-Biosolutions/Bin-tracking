import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp } from './client-ip.js';

const req = (headers: Record<string, string | string[]> = {}, ip = '10.0.0.1') => ({ ip, headers }) as never;

describe('clientIp', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('uses the socket address by default and ignores any client-supplied header', () => {
        expect(clientIp(req({ 'x-nf-client-connection-ip': '203.0.113.9' }))).toBe('10.0.0.1');
    });

    it('uses the configured header when CLIENT_IP_HEADER is set', () => {
        vi.stubEnv('CLIENT_IP_HEADER', 'X-NF-Client-Connection-IP'); // case-insensitive name
        expect(clientIp(req({ 'x-nf-client-connection-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    });

    it('takes the first address of a comma-separated list', () => {
        vi.stubEnv('CLIENT_IP_HEADER', 'x-forwarded-for');
        expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 70.41.3.18' }))).toBe('203.0.113.9');
        expect(clientIp(req({ 'x-forwarded-for': ['198.51.100.7', 'x'] }))).toBe('198.51.100.7');
    });

    it('falls back to the socket address when the header is missing, empty or absurd', () => {
        vi.stubEnv('CLIENT_IP_HEADER', 'x-nf-client-connection-ip');
        expect(clientIp(req())).toBe('10.0.0.1');
        expect(clientIp(req({ 'x-nf-client-connection-ip': '   ' }))).toBe('10.0.0.1');
        expect(clientIp(req({ 'x-nf-client-connection-ip': 'a'.repeat(200) }))).toBe('10.0.0.1');
    });
});
