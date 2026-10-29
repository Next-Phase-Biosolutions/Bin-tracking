/**
 * Facility zone ids a SensorDevice can be assigned to. Zones are frontend
 * constants (apps/web/src/lib/facility-zones-data.ts) with no backend table, so
 * this list is how registration rejects a typo — a device assigned to a
 * misspelled zone would be saved but never shown on any page.
 * Keep in sync with the `id`s in facility-zones-data.ts.
 */
export const SENSOR_ZONE_IDS = ['receiving', 'killfloor', 'processing', 'wetaging', 'valueadd', 'shipping'] as const;

export type SensorZoneId = (typeof SENSOR_ZONE_IDS)[number];

export function isSensorZoneId(value: string): value is SensorZoneId {
    return (SENSOR_ZONE_IDS as readonly string[]).includes(value);
}
