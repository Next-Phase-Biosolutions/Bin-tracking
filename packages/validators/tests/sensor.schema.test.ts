import { describe, expect, it } from 'vitest';
import { ingestSensorReadingSchema, RAW_PAYLOAD_MAX_BYTES } from '../src/sensor.schema.js';

const minimal = { p_device_id: 'master-01', p_raw: { battery_mv: 3712 } };

describe('ingestSensorReadingSchema', () => {
    it('accepts the minimal payload (device id + raw only)', () => {
        const result = ingestSensorReadingSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });

    it('accepts every documented optional field', () => {
        const result = ingestSensorReadingSchema.safeParse({
            ...minimal,
            p_temp_c: 24.6,
            p_humidity_pct: 51.2,
            p_rssi: -67,
            p_snr: 9.5,
            p_filtered_rssi: -66.2,
            p_error_code: 100,
            p_error_message: 'sensor read timeout after 3 retries',
            p_timestamp: '2026-10-29T10:00:00Z',
        });
        expect(result.success).toBe(true);
    });

    it('accepts a fault-only reading with no temp or humidity', () => {
        const result = ingestSensorReadingSchema.safeParse({ ...minimal, p_error_code: 100 });
        expect(result.success).toBe(true);
    });

    it('treats explicit nulls like omitted fields', () => {
        const result = ingestSensorReadingSchema.safeParse({ ...minimal, p_temp_c: null, p_error_code: null });
        expect(result.success).toBe(true);
    });

    it('trims the device id and rejects an empty one', () => {
        const trimmed = ingestSensorReadingSchema.parse({ ...minimal, p_device_id: '  master-01  ' });
        expect(trimmed.p_device_id).toBe('master-01');
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_device_id: '   ' }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ p_raw: {} }).success).toBe(false);
    });

    it('rejects an over-long device id', () => {
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_device_id: 'x'.repeat(129) }).success).toBe(false);
    });

    it('requires p_raw to be an object, not an array or scalar', () => {
        expect(ingestSensorReadingSchema.safeParse({ p_device_id: 'a', p_raw: [1] }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ p_device_id: 'a', p_raw: 'x' }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ p_device_id: 'a' }).success).toBe(false);
    });

    it('rejects a p_raw whose JSON is at or over the size cap', () => {
        const big = { blob: 'x'.repeat(RAW_PAYLOAD_MAX_BYTES) };
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_raw: big }).success).toBe(false);
    });

    it('rejects non-finite or non-numeric metrics', () => {
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_temp_c: 'hot' }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_rssi: Number.POSITIVE_INFINITY }).success).toBe(false);
    });

    it('requires p_error_code to be an integer', () => {
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_error_code: 1.5 }).success).toBe(false);
    });

    it('rejects an over-long error message', () => {
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_error_message: 'e'.repeat(501) }).success).toBe(false);
    });

    it('rejects a malformed timestamp', () => {
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_timestamp: 'yesterday' }).success).toBe(false);
    });

    it('rejects a timestamp more than the clock-skew allowance in the future', () => {
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_timestamp: future }).success).toBe(false);
    });

    it('accepts a timestamp slightly ahead of server time (device clock skew)', () => {
        const skewed = new Date(Date.now() + 60 * 1000).toISOString();
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_timestamp: skewed }).success).toBe(true);
    });

    it('rejects a timestamp older than the backfill window', () => {
        const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_timestamp: old }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_timestamp: '1970-01-01T00:00:00Z' }).success).toBe(false);
    });

    it('accepts a timestamp inside the backfill window (buffered upload)', () => {
        const recent = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_timestamp: recent }).success).toBe(true);
    });

    it('rejects NUL characters Postgres cannot store (device id, raw, error message)', () => {
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_device_id: 'a\u0000b' }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_raw: { note: 'a\u0000b' } }).success).toBe(false);
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_error_message: 'a\u0000b' }).success).toBe(false);
    });

    it('measures the p_raw cap in bytes, not characters', () => {
        // 4000 three-byte characters = 4000 chars but ~12 KB on the wire.
        const wide = { note: '€'.repeat(4000) };
        expect(ingestSensorReadingSchema.safeParse({ ...minimal, p_raw: wide }).success).toBe(false);
    });
});
