import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CONFIRMED_DOWNLOAD_PARAMS,
    ALL_DOWNLOAD_PARAMS,
    EcoSafeSenseClient,
    computeRefreshDelayMs,
    parseDownloadRow,
} from './ecosafesense.client.js';

function makeJwt(payload: Record<string, unknown>): string {
    const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.signature`;
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('parseDownloadRow', () => {
    it('parses ammonia_ppm string values to floats (test case 1)', () => {
        const row = parseDownloadRow(
            { timestamp: '2026-08-05T00:00:00Z', temperature_celsius: 4, humidity: 50, ammonia_ppm: '0.0909' },
            CONFIRMED_DOWNLOAD_PARAMS,
        );
        expect(row?.nh3Ppm).toBe(0.0909);
        expect(typeof row?.nh3Ppm).toBe('number');
    });

    it('skips an unparseable ammonia_ppm as null, never NaN (test case 2)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const row = parseDownloadRow(
            { timestamp: '2026-08-05T00:00:00Z', temperature_celsius: 4, humidity: 50, ammonia_ppm: 'not-a-number' },
            CONFIRMED_DOWNLOAD_PARAMS,
        );
        expect(row?.nh3Ppm).toBeNull();
        expect(Number.isNaN(row?.nh3Ppm)).toBe(false);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('drops the whole row when the required tempC/humidityPct are missing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const row = parseDownloadRow({ timestamp: '2026-08-05T00:00:00Z', ammonia_ppm: '1.2' }, CONFIRMED_DOWNLOAD_PARAMS);
        expect(row).toBeNull();
        warn.mockRestore();
    });

    it('captures all 9 fields when all 9 are requested, not just the original 3', () => {
        const row = parseDownloadRow(
            {
                timestamp: '2026-08-05T00:00:00Z',
                temperature_celsius: 4,
                humidity: 50,
                ammonia_ppm: '0.1',
                aqhi_plus: 2,
                tvoc: 10,
                eco2_ppm: 400,
                ozone_ppb: 5,
                pressure: 1013,
                pm_25: 8,
            },
            ALL_DOWNLOAD_PARAMS,
        );
        expect(row).toMatchObject({
            tempC: 4,
            humidityPct: 50,
            nh3Ppm: 0.1,
            aqhiPlus: 2,
            tvoc: 10,
            eco2Ppm: 400,
            ozonePpb: 5,
            pressure: 1013,
            pm25: 8,
        });
    });
});

describe('computeRefreshDelayMs (half-life scheduling)', () => {
    it('schedules refresh at half of a 3600s token duration (test case 6)', () => {
        const nowS = Math.floor(Date.now() / 1000);
        const token = makeJwt({ iat: nowS, exp: nowS + 3600 });
        expect(computeRefreshDelayMs(token)).toBe(1_800_000);
    });

    it('schedules refresh at half of an 86400s token duration (test case 6)', () => {
        const nowS = Math.floor(Date.now() / 1000);
        const token = makeJwt({ iat: nowS, exp: nowS + 86_400 });
        expect(computeRefreshDelayMs(token)).toBe(43_200_000);
    });

    it('falls back to a fixed 30-minute interval for an opaque, non-JWT token (test case 7)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(computeRefreshDelayMs('not-a-jwt-token')).toBe(30 * 60 * 1000);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('FALLBACK ACTIVE'));
        warn.mockRestore();
    });
});

describe('EcoSafeSenseClient', () => {
    const creds = { baseUrl: 'https://vendor.example', clientId: 'id', clientSecret: 'secret' };
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function tokenResponse(expiresInS = 3600): Response {
        const nowS = Math.floor(Date.now() / 1000);
        return jsonResponse(200, { token: makeJwt({ iat: nowS, exp: nowS + expiresInS }) });
    }

    it('retries with only the 4 confirmed fields when the 9-field /download request is rejected (test case 8)', async () => {
        fetchMock
            .mockResolvedValueOnce(tokenResponse()) // auth
            .mockResolvedValueOnce(new Response('bad request', { status: 400 })) // 9-field attempt
            .mockResolvedValueOnce(
                jsonResponse(200, { readings: [{ timestamp: '2026-08-05T00:00:00Z', temperature_celsius: 4, humidity: 50 }] }),
            ); // 4-field retry

        const client = new EcoSafeSenseClient(creds);
        const { readings, fieldsUsed } = await client.fetchReadings('dev-1', new Date('2026-08-04'), new Date('2026-08-05'));

        expect(fieldsUsed).toEqual(CONFIRMED_DOWNLOAD_PARAMS);
        expect(readings).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        const secondCallUrl = new URL(String(fetchMock.mock.calls[1]![0]));
        expect(secondCallUrl.pathname).toBe('/api/v1/download/dev-1');
        expect(secondCallUrl.searchParams.get('fields')).toBe(['timestamp', ...ALL_DOWNLOAD_PARAMS].join(','));
        const thirdCallUrl = new URL(String(fetchMock.mock.calls[2]![0]));
        expect(thirdCallUrl.pathname).toBe('/api/v1/download/dev-1');
        expect(thirdCallUrl.searchParams.get('fields')).toBe(['timestamp', ...CONFIRMED_DOWNLOAD_PARAMS].join(','));
    });

    it('re-authenticates and retries once on a mid-loop 401, without crashing (test case 5)', async () => {
        fetchMock
            .mockResolvedValueOnce(tokenResponse()) // initial auth
            .mockResolvedValueOnce(new Response(null, { status: 401 })) // expired mid-loop
            .mockResolvedValueOnce(tokenResponse()) // re-auth
            .mockResolvedValueOnce(jsonResponse(200, { readings: [] })); // retried request succeeds

        const client = new EcoSafeSenseClient(creds);
        const { readings } = await client.fetchReadings('dev-1', new Date('2026-08-04'), new Date('2026-08-05'));

        expect(readings).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
