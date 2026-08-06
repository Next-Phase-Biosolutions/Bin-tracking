/**
 * Facility zone → EcoSafeSense device mapping.
 *
 * `SensorDevice` carries `organizationId` and `facilityId` but has no zone
 * column, and facility zones are frontend-only constants (facility-zones-data.ts)
 * with no backend representation at all — so nothing in the API can answer
 * "which device is in Wet Aging". This map is that link until one exists.
 *
 * ponytail: single-device demo mapping via env var. Replace with a
 * `SensorDevice.zone` column once a second zone gets a sensor — this shape
 * cannot express two devices in one zone, or one device shared across zones.
 */

import type { RouterOutputs } from './trpc';

/** Zone id (see `zones` in facility-zones-data.ts) → vendor device `externalId`. */
const ZONE_SENSOR_EXTERNAL_IDS: Record<string, string | undefined> = {
    wetaging: import.meta.env.VITE_ZONE_SENSOR_WETAGING,
};

/**
 * The vendor device id wired to this zone, or `undefined` when the zone has no
 * sensor configured — callers fall back to the zone's mock readings rather than
 * firing a query that can only come back empty.
 */
export function sensorIdForZone(zoneId: string): string | undefined {
    return ZONE_SENSOR_EXTERNAL_IDS[zoneId] || undefined;
}

type SensorDevice = RouterOutputs['sensor']['listDevices']['devices'][number];
type SensorReading = SensorDevice['readings'][number];

/** Same shape as `ZoneEnv` so the zone page renders live and mock rows through one loop. */
export interface ZoneEnvRow {
    label: string;
    value: number;
    unit: string;
    decimals: number;
}

/**
 * The four metrics worth surfacing on a zone card, in the order the mock data
 * established (temperature, humidity, co2) plus ammonia — the one air-quality
 * reading that actually matters for aging meat. The other five the device
 * reports have no thresholds and no place on a summary card; they belong on a
 * dedicated environment page if one ever gets built.
 *
 * Temperature is shown in °C, not the mock's °F: the sensor reports Celsius and
 * every other zone's mock readings are already Celsius, so converting here would
 * make Wet Aging the only zone in a different unit.
 */
export function toEnvRows(reading: SensorReading): ZoneEnvRow[] {
    const rows: Array<ZoneEnvRow | null> = [
        { label: 'temperature', value: reading.tempC, unit: '°C', decimals: 1 },
        { label: 'humidity', value: reading.humidityPct, unit: '%', decimals: 0 },
        reading.nh3Ppm === null ? null : { label: 'ammonia', value: reading.nh3Ppm, unit: 'ppm', decimals: 4 },
        reading.eco2Ppm === null ? null : { label: 'co2_levels', value: reading.eco2Ppm, unit: 'ppm', decimals: 0 },
    ];
    return rows.filter((row): row is ZoneEnvRow => row !== null);
}

/** Past this, the card stops claiming the reading is current. Poll cadence is ~10 min. */
const STALE_AFTER_MS = 20 * 60 * 1000;

/**
 * `lastSeenAt` tracks the newest reading's timestamp, not the last successful
 * poll — a device that is powered off but still being polled reads as stale,
 * which is the honest answer for a card showing environmental conditions.
 */
export function describeLastSeen(lastSeenAt: Date | null): { text: string; isStale: boolean } {
    if (!lastSeenAt) return { text: 'no readings yet', isStale: true };

    const elapsedMs = Date.now() - lastSeenAt.getTime();
    const minutes = Math.floor(elapsedMs / 60_000);
    if (minutes < 1) return { text: 'updated just now', isStale: false };

    const isStale = elapsedMs > STALE_AFTER_MS;
    if (minutes < 60) return { text: `updated ${minutes}m ago`, isStale };

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { text: `updated ${hours}h ago`, isStale };
    return { text: `updated ${Math.floor(hours / 24)}d ago`, isStale };
}
