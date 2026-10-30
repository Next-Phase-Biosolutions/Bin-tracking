interface ResolvableZone {
  slug: string;
  facilityId: string;
  facilityName: string;
}

/**
 * Which facility's zone a /app/zones/:slug page shows: the requested one if it
 * has the slug; otherwise the first (by name) whose zone has a sensor, so a user
 * with many facilities lands where the data is instead of on a mock layout; and
 * failing that, the first by name. A facility id the caller can't see simply
 * isn't in `zones`, so it can never be selected.
 */
export function resolveZoneFacility<T extends ResolvableZone>(
  zones: readonly T[],
  slug: string,
  requestedFacilityId: string | null,
  sensorCounts: ReadonlyMap<string, number> = new Map(),
): T | undefined {
  const matches = zones.filter((zone) => zone.slug === slug);
  const byName = [...matches].sort((a, b) => a.facilityName.localeCompare(b.facilityName));
  return (
    matches.find((zone) => zone.facilityId === requestedFacilityId) ??
    byName.find((zone) => (sensorCounts.get(zone.facilityId) ?? 0) > 0) ??
    byName[0]
  );
}

/** Devices per facility for one zone slug (all the caller's active devices, so counts are tenant-scoped). */
export function sensorCountsByFacility(
  devices: ReadonlyArray<{ facility: { id: string }; zone: { slug: string } | null }> | undefined,
  slug: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const device of devices ?? []) {
    if (device.zone?.slug !== slug) continue;
    counts.set(device.facility.id, (counts.get(device.facility.id) ?? 0) + 1);
  }
  return counts;
}

/** The facilities that have this zone, by name — for the page's facility switcher. */
export function facilitiesWithZone(
  zones: readonly ResolvableZone[],
  slug: string,
  sensorCounts: ReadonlyMap<string, number> = new Map(),
): Array<{ id: string; name: string; sensorCount: number }> {
  return zones
    .filter((zone) => zone.slug === slug)
    .map((zone) => ({ id: zone.facilityId, name: zone.facilityName, sensorCount: sensorCounts.get(zone.facilityId) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ZoneViewMode = 'sensor' | 'mock' | 'placeholder' | 'generic';

/** Built-out zone pages that still carry mock content when no sensor is assigned. */
const MOCK_ZONE_SLUGS = new Set(['killfloor', 'wetaging']);
/** The other original zones: no built-out view yet, so they keep the "Not accessible" card. */
const PLACEHOLDER_ZONE_SLUGS = new Set(['receiving', 'processing', 'valueadd', 'shipping']);

/**
 * A zone with an assigned device always shows the sensor view. Without one, the
 * two built-out original zones keep their mock layout, the other four keep the
 * placeholder, and any zone an admin created shows "no sensor assigned".
 */
export function zoneViewMode(input: { slug: string; hasDevice: boolean }): ZoneViewMode {
  if (input.hasDevice) return 'sensor';
  if (MOCK_ZONE_SLUGS.has(input.slug)) return 'mock';
  if (PLACEHOLDER_ZONE_SLUGS.has(input.slug)) return 'placeholder';
  return 'generic';
}

export type ZonePageState = 'loading' | 'error' | 'missing' | 'ready';

/**
 * What the zone page should do before it can show a zone. It waits for the zone
 * and device lists (so a valid link is never redirected and mock data never
 * flashes); a FAILED zones query is an error to show, never a "not found" — a
 * network blip must not bounce a valid zone link to the dashboard. Only a zones
 * list that loaded fine without this slug is "missing". A failed devices query
 * does not block: the zone simply has no sensor.
 */
export function zonePageState(input: {
  zonesLoading: boolean;
  zonesError: boolean;
  devicesLoading: boolean;
  hasZone: boolean;
}): ZonePageState {
  if (input.zonesLoading || input.devicesLoading) return 'loading';
  if (input.zonesError) return 'error';
  return input.hasZone ? 'ready' : 'missing';
}
