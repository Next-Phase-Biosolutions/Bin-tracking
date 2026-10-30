interface ResolvableZone {
  slug: string;
  facilityId: string;
  facilityName: string;
}

/**
 * Which facility's zone a /app/zones/:slug page shows: the requested one if it
 * has the slug, otherwise the first (by facility name) that does. A facility id
 * the caller can't see simply isn't in `zones`, so it can never be selected.
 */
export function resolveZoneFacility<T extends ResolvableZone>(
  zones: readonly T[],
  slug: string,
  requestedFacilityId: string | null,
): T | undefined {
  const matches = zones.filter((zone) => zone.slug === slug);
  return (
    matches.find((zone) => zone.facilityId === requestedFacilityId) ??
    [...matches].sort((a, b) => a.facilityName.localeCompare(b.facilityName))[0]
  );
}

/** The facilities that have this zone, by name — for the page's facility switcher. */
export function facilitiesWithZone(zones: readonly ResolvableZone[], slug: string): Array<{ id: string; name: string }> {
  return zones
    .filter((zone) => zone.slug === slug)
    .map((zone) => ({ id: zone.facilityId, name: zone.facilityName }))
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
