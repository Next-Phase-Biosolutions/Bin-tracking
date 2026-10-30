import type { NavItem } from './nav';

/** The fields of a tenant zone (zone.listMine) the sidebar needs. */
interface NavZone {
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  facilityName: string;
}

/**
 * One sidebar entry per zone slug, even when several of the caller's facilities
 * have that zone (the page itself offers a facility switcher). Ordered by the
 * smallest sortOrder seen for the slug, then by name.
 */
export function zonesToNavItems(zones: readonly NavZone[]): NavItem[] {
  const bySlug = new Map<string, NavZone>();
  for (const zone of zones) {
    const seen = bySlug.get(zone.slug);
    if (!seen || zone.sortOrder < seen.sortOrder) bySlug.set(zone.slug, zone);
  }
  return [...bySlug.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((zone) => ({ label: zone.name, href: `/app/zones/${zone.slug}`, icon: zone.icon }));
}
