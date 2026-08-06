/**
 * EcoSafeSense vendor API client — token auth, `/download` fetch, and
 * response parsing live here (not inline in backfill-sensors.ts) so a
 * future live-ingestion worker (see cross-cutting note #2) reuses this
 * instead of duplicating or rewriting it.
 *
 * Wire-format note: confirmed against the live API's `/openapi.json` and a
 * real request on 2026-08-05. `client-token` takes `{ clientId, clientSecret }`
 * (camelCase). `/download` is `GET /api/v1/download/{deviceId}` — deviceId is
 * a PATH param, not a query param — and `fields` must list `timestamp`
 * explicitly or rows come back without one. The response is a bare JSON
 * array, not wrapped in an envelope. All 9 fields (not just the 4 the doc
 * called "confirmed") returned 200 with response keys matching the request
 * param names exactly — the 9-then-4 fallback below is kept anyway per the
 * doc's instruction, since a future device/firmware could still reject the
 * unconfirmed 5.
 */

export interface EcoSafeSenseCredentials {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
}

export interface ParsedSensorReading {
    timestamp: Date;
    tempC: number;
    humidityPct: number;
    nh3Ppm: number | null;
    tvoc: number | null;
    eco2Ppm: number | null;
    aqhiPlus: number | null;
    ozonePpb: number | null;
    pressure: number | null;
    pm25: number | null;
}

// Field-name mapping (03_backfill_script.md step 2) — three spellings for
// the same value across /lastReading, /download, and the schema. This is
// the /download query-param name (left, what we request) -> schema column
// (right, what we store) — the only two spellings this client bridges.
// /download's actual RESPONSE key names for the 5 unconfirmed fields
// (everything past aqhi_plus below) are UNVERIFIED — we assume the response
// echoes the request param name until real data proves otherwise.
const DOWNLOAD_PARAM_TO_COLUMN = {
    temperature_celsius: 'tempC',
    humidity: 'humidityPct',
    ammonia_ppm: 'nh3Ppm',
    aqhi_plus: 'aqhiPlus',
    tvoc: 'tvoc',
    eco2_ppm: 'eco2Ppm',
    ozone_ppb: 'ozonePpb',
    pressure: 'pressure',
    pm_25: 'pm25',
} as const satisfies Record<string, keyof Omit<ParsedSensorReading, 'timestamp'>>;

export type DownloadParam = keyof typeof DOWNLOAD_PARAM_TO_COLUMN;

// Only these 4 are confirmed to work as /download query params (Action Item 1).
// The other 5 have only ever been seen in /lastReading's response.
export const CONFIRMED_DOWNLOAD_PARAMS: readonly DownloadParam[] = [
    'temperature_celsius',
    'humidity',
    'ammonia_ppm',
    'aqhi_plus',
];
export const ALL_DOWNLOAD_PARAMS: readonly DownloadParam[] = Object.keys(
    DOWNLOAD_PARAM_TO_COLUMN,
) as DownloadParam[];

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

/**
 * Parses one raw `/download` row into schema-shaped values. Only the fields
 * actually requested (`requestedParams`) are read off the row. A row missing
 * a valid `timestamp`, `temperature_celsius`, or `humidity` is dropped
 * entirely (those three are non-nullable in the schema); any other field
 * that fails to parse is logged and stored as `null`, not `NaN` — this is
 * what makes the `ammonia_ppm` malformed-input case safe.
 */
export function parseDownloadRow(
    raw: Record<string, unknown>,
    requestedParams: readonly DownloadParam[],
): ParsedSensorReading | null {
    const rawTimestamp = raw['timestamp'];
    const timestamp =
        typeof rawTimestamp === 'string' || typeof rawTimestamp === 'number' ? new Date(rawTimestamp) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) {
        console.warn(`[ecosafesense] dropping row with unparseable timestamp: ${JSON.stringify(rawTimestamp)}`);
        return null;
    }

    const values: Partial<Record<(typeof DOWNLOAD_PARAM_TO_COLUMN)[DownloadParam], number | null>> = {};
    for (const param of requestedParams) {
        const column = DOWNLOAD_PARAM_TO_COLUMN[param];
        const rawValue = raw[param];
        const parsed = toFiniteNumber(rawValue);
        if (parsed === null && rawValue !== undefined && rawValue !== null) {
            console.warn(
                `[ecosafesense] dropping unparseable ${param}=${JSON.stringify(rawValue)} on row at ${timestamp.toISOString()} (field stored as null)`,
            );
        }
        values[column] = parsed;
    }

    if (values.tempC == null || values.humidityPct == null) {
        console.warn(
            `[ecosafesense] dropping row at ${timestamp.toISOString()} — missing required temperature_celsius/humidity`,
        );
        return null;
    }

    return {
        timestamp,
        tempC: values.tempC,
        humidityPct: values.humidityPct,
        nh3Ppm: values.nh3Ppm ?? null,
        tvoc: values.tvoc ?? null,
        eco2Ppm: values.eco2Ppm ?? null,
        aqhiPlus: values.aqhiPlus ?? null,
        ozonePpb: values.ozonePpb ?? null,
        pressure: values.pressure ?? null,
        pm25: values.pm25 ?? null,
    };
}

// Vendor confirmed the advertised token lifetime is in flux (misconfigured
// at 1h, changing to 24h with no confirmed landing time) — never hardcode a
// refresh interval derived from either number. Used only when the token
// can't be decoded as a JWT at all.
const FALLBACK_REFRESH_MS = 30 * 60 * 1000;

function base64UrlDecode(segment: string): string {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64').toString('utf8');
}

function decodeJwtPayload(token: string): { iat: number; exp: number } {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('not a JWT (expected 3 dot-separated segments)');
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as Record<string, unknown>;
    if (typeof payload['iat'] !== 'number' || typeof payload['exp'] !== 'number') {
        throw new Error('JWT payload missing numeric iat/exp');
    }
    return { iat: payload['iat'], exp: payload['exp'] };
}

/**
 * Half-life refresh policy (03_backfill_script.md step 5): re-authenticate
 * at half the token's actual decoded validity duration, never at expiry —
 * so a slow cycle or clock drift can't cause a mid-cycle 401. Assumes the
 * token is a decodable JWT; if it isn't, falls back to a conservative fixed
 * interval and logs loudly rather than crashing the poller at startup.
 */
export function computeRefreshDelayMs(token: string): number {
    try {
        const { iat, exp } = decodeJwtPayload(token);
        const durationS = exp - iat;
        const halfLifeMs = (durationS * 1000) / 2;
        console.log(`[ecosafesense] token valid for ${durationS}s, will refresh at ${Math.round(halfLifeMs / 1000)}s`);
        return halfLifeMs;
    } catch (err) {
        console.warn(
            `[ecosafesense] FALLBACK ACTIVE — could not decode token as a JWT (${(err as Error).message}); ` +
                `using fixed ${FALLBACK_REFRESH_MS / 1000}s refresh interval instead of the half-life policy`,
        );
        return FALLBACK_REFRESH_MS;
    }
}

interface TokenState {
    token: string;
    refreshAt: number;
}

export class EcoSafeSenseClient {
    private token: TokenState | null = null;
    private authenticating: Promise<TokenState> | null = null;

    constructor(private readonly creds: EcoSafeSenseCredentials) {}

    private async authenticate(): Promise<TokenState> {
        const res = await fetch(`${this.creds.baseUrl}/api/v1/auth/client-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: this.creds.clientId, clientSecret: this.creds.clientSecret }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`ecosafesense auth failed: ${res.status} ${res.statusText} ${detail}`);
        }
        const body = (await res.json()) as { token?: string };
        if (!body.token) throw new Error('ecosafesense auth response missing "token"');

        const state: TokenState = { token: body.token, refreshAt: Date.now() + computeRefreshDelayMs(body.token) };
        this.token = state;
        return state;
    }

    private async getToken(forceRefresh = false): Promise<string> {
        if (!forceRefresh && this.token && Date.now() < this.token.refreshAt) {
            return this.token.token;
        }
        // Collapse concurrent callers onto one in-flight auth call.
        if (!this.authenticating) {
            this.authenticating = this.authenticate().finally(() => {
                this.authenticating = null;
            });
        }
        return (await this.authenticating).token;
    }

    private async authorizedFetch(path: string): Promise<Response> {
        const token = await this.getToken();
        let res = await fetch(`${this.creds.baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
            // Reactive backstop, independent of the scheduled half-life refresh.
            console.warn('[ecosafesense] got 401, re-authenticating and retrying once');
            const fresh = await this.getToken(true);
            res = await fetch(`${this.creds.baseUrl}${path}`, { headers: { Authorization: `Bearer ${fresh}` } });
        }
        return res;
    }

    /** Confirms the vendor's known device list — logged, not load-bearing. */
    async listDevices(): Promise<unknown[]> {
        const res = await this.authorizedFetch('/api/v1/sensors');
        if (!res.ok) {
            console.warn(`[ecosafesense] GET /api/v1/sensors failed: ${res.status} ${res.statusText}`);
            return [];
        }
        const body = (await res.json()) as unknown;
        return Array.isArray(body) ? body : ((body as { devices?: unknown[] }).devices ?? []);
    }

    /**
     * Fetches and parses readings for [from, to]. Tries all 9 fields first;
     * if `/download` doesn't return 200, retries with only the 4 confirmed
     * fields and logs which were dropped — so one unverified field name
     * can't take the whole backfill down.
     */
    async fetchReadings(
        deviceExternalId: string,
        from: Date,
        to: Date,
    ): Promise<{ readings: ParsedSensorReading[]; fieldsUsed: readonly DownloadParam[] }> {
        const attempt = (params: readonly DownloadParam[]) => {
            const query = new URLSearchParams({
                from: from.toISOString(),
                to: to.toISOString(),
                // `timestamp` must be listed explicitly or rows come back without
                // one — confirmed against the live API's openapi.json example.
                fields: ['timestamp', ...params].join(','),
            });
            return this.authorizedFetch(`/api/v1/download/${encodeURIComponent(deviceExternalId)}?${query.toString()}`);
        };

        let fieldsUsed = ALL_DOWNLOAD_PARAMS;
        let res = await attempt(fieldsUsed);
        if (res.status !== 200) {
            const dropped = ALL_DOWNLOAD_PARAMS.filter((p) => !CONFIRMED_DOWNLOAD_PARAMS.includes(p));
            console.warn(
                `[ecosafesense] /download rejected the 9-field request (status ${res.status}); ` +
                    `retrying with only the 4 confirmed fields, dropping: ${dropped.join(', ')}`,
            );
            fieldsUsed = CONFIRMED_DOWNLOAD_PARAMS;
            res = await attempt(fieldsUsed);
        }
        if (res.status !== 200) {
            throw new Error(`ecosafesense /download failed even with the 4 confirmed fields: ${res.status} ${res.statusText}`);
        }

        const body = (await res.json()) as unknown;
        const rawRows = Array.isArray(body) ? body : ((body as { readings?: unknown[] }).readings ?? []);
        const readings: ParsedSensorReading[] = [];
        for (const raw of rawRows) {
            const parsed = parseDownloadRow(raw as Record<string, unknown>, fieldsUsed);
            if (parsed) readings.push(parsed);
        }
        return { readings, fieldsUsed };
    }
}
