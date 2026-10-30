import { z } from 'zod';
import { sensorDeviceIdProblem, ZONE_ICON_NAMES } from '@bin-tracker/types';

// ─── List Devices ──────────────────────────────────────────────

export const listDevicesSchema = z.object({ facilityId: z.string().optional() });

export type ListDevicesInput = z.infer<typeof listDevicesSchema>;

// ─── Sensor Reading Range ──────────────────────────────────────

export const sensorReadingRangeSchema = z.object({
    deviceId: z.string(),
    range: z.enum(['24h', '7d']).default('24h'),
});

export type SensorReadingRangeInput = z.infer<typeof sensorReadingRangeSchema>;

// ─── Device Ingest (push) ──────────────────────────────────────
// Field names deliberately mirror the firmware handoff doc
// (sensor-integration-testing → docs/device-uplink-reference.html) so devices
// only change the URL and key, not the body.

/** `p_raw` must serialize to fewer bytes than this (matches the reference project's 10 KB cap). */
export const RAW_PAYLOAD_MAX_BYTES = 10_000;

/** Device clocks drift; tolerate a little skew but not a wildly future timestamp. */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** How far back a device may stamp a reading (buffered uploads after an outage). */
const MAX_PAST_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Postgres cannot store NUL in text or jsonb; left in, it surfaces as a 500
// from the insert instead of a clean 400.
const NUL = '\u0000';
const noNul = (value: string): boolean => !value.includes(NUL);
const NO_NUL_MESSAGE = 'must not contain NUL characters';

/** A device id (see `sensorDeviceIdProblem`); trims, and the failure message is the reason. */
export const sensorDeviceIdSchema = z.string().trim().superRefine((id, ctx) => {
    const problem = sensorDeviceIdProblem(id);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

// Devices may send an explicit null for "no value"; treat it like omitted.
const optionalMetric = z.number().finite().nullish();

// No TextEncoder/Buffer here: this package also ships to the browser and its
// tsconfig has neither lib. Lone surrogates count as 3 bytes, as UTF-8 encoders do (U+FFFD).
function utf8Bytes(text: string): number {
    let bytes = 0;
    for (const char of text) {
        const codePoint = char.codePointAt(0)!;
        bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
    }
    return bytes;
}

export const ingestSensorReadingSchema = z.object({
    p_device_id: sensorDeviceIdSchema,
    p_raw: z.record(z.string(), z.unknown()).refine(
        (raw) => {
            const json = JSON.stringify(raw);
            // jsonb escapes NUL as the 6-char sequence backslash-u0000 in the stringified form.
            return utf8Bytes(json) < RAW_PAYLOAD_MAX_BYTES && !json.includes('\\u0000');
        },
        { message: `p_raw must be under ${RAW_PAYLOAD_MAX_BYTES} bytes and contain no NUL characters` },
    ),
    p_temp_c: optionalMetric,
    p_humidity_pct: optionalMetric,
    p_rssi: optionalMetric,
    p_snr: optionalMetric,
    p_filtered_rssi: optionalMetric,
    p_error_code: z.number().int().nullish(),
    p_error_message: z.string().max(500).refine(noNul, NO_NUL_MESSAGE).nullish(),
    // Optional device-side measurement time; server time is used when absent.
    p_timestamp: z
        .string()
        .datetime({ offset: true })
        .refine((ts) => new Date(ts).getTime() <= Date.now() + MAX_FUTURE_SKEW_MS, {
            message: 'p_timestamp is too far in the future',
        })
        .refine((ts) => new Date(ts).getTime() >= Date.now() - MAX_PAST_AGE_MS, {
            message: 'p_timestamp is too far in the past',
        })
        .nullish(),
});

export type IngestSensorReadingInput = z.infer<typeof ingestSensorReadingSchema>;

// ─── Platform-admin fleet management ───────────────────────────

// Defined in @bin-tracker/types (the web app needs it at runtime and does not depend on this package).
export { parseDeviceIdList } from '@bin-tracker/types';

// Per-id validation (including length) happens in the service, so one bad or over-long token
// is reported as invalid instead of rejecting the whole pasted batch.
export const addSensorDevicesSchema = z.object({
    externalIds: z.array(z.string()).min(1).max(500),
});

export type AddSensorDevicesInput = z.infer<typeof addSensorDevicesSchema>;

export const assignSensorDeviceSchema = z.object({
    deviceId: z.string(),
    organizationId: z.string(),
    facilityId: z.string(),
    zoneId: z.string(),
    name: z.string().trim().min(1).max(80),
    enableModule: z.boolean().default(false),
});

export type AssignSensorDeviceInput = z.infer<typeof assignSensorDeviceSchema>;

export const reassignSensorDeviceSchema = assignSensorDeviceSchema;

export type ReassignSensorDeviceInput = z.infer<typeof reassignSensorDeviceSchema>;

export const sensorDeviceRefSchema = z.object({ deviceId: z.string() });

export const fleetListSchema = z.object({
    state: z.enum(['UNASSIGNED', 'ACTIVE', 'DEACTIVATED']).optional(),
    organizationId: z.string().optional(),
    facilityId: z.string().optional(),
    zoneId: z.string().optional(),
    health: z.enum(['online', 'offline', 'fault', 'waiting']).optional(),
    search: z.string().max(64).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
});

export type FleetListInput = z.infer<typeof fleetListSchema>;

export const adminReadingRangeSchema = z.object({
    deviceId: z.string(),
    range: z.enum(['24h', '7d', '30d']).default('24h'),
});

export type AdminReadingRangeInput = z.infer<typeof adminReadingRangeSchema>;

export const viewAsTenantSchema = z.object({ organizationId: z.string() });

export const viewAsTenantReadingsSchema = z.object({
    organizationId: z.string(),
    deviceId: z.string(),
    range: z.enum(['24h', '7d']).default('24h'),
});

export const setOfflineThresholdSchema = z.object({ minutes: z.number().int().min(1).max(1440) });

// ─── Zones ─────────────────────────────────────────────────────

export const facilityRefSchema = z.object({ facilityId: z.string() });

export const zoneRefSchema = z.object({ zoneId: z.string() });

export const createZoneSchema = z.object({
    facilityId: z.string(),
    name: z.string().trim().min(1).max(60),
    icon: z.enum(ZONE_ICON_NAMES).default('grid'),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const renameZoneSchema = z.object({ zoneId: z.string(), name: z.string().trim().min(1).max(60) });

export const reorderZonesSchema = z.object({
    facilityId: z.string(),
    zoneIds: z.array(z.string()).min(1).max(100),
});

export type ReorderZonesInput = z.infer<typeof reorderZonesSchema>;
