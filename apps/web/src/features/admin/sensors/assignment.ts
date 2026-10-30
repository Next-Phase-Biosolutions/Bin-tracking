/** An org's assignable facilities and zones (sensorAdmin.orgAssignmentOptions). */
export interface AssignmentOptions {
  moduleEnabled: boolean;
  facilities: Array<{ id: string; name: string; zones: Array<{ id: string; name: string; slug: string }> }>;
}

const NAME_MAX = 80;

/** The assign form can submit only with every choice made and a usable name (the API trims and caps it at 80). */
export function isAssignmentComplete(form: { organizationId: string; facilityId: string; zoneId: string; name: string }): boolean {
  const name = form.name.trim();
  return Boolean(form.organizationId && form.facilityId && form.zoneId) && name.length > 0 && name.length <= NAME_MAX;
}

/**
 * Facility and zone to select after the organization (or facility) changes:
 * keep the previous facility if the new options still contain it, otherwise
 * the first one; then that facility's first zone. Empty strings when there is
 * nothing to pick.
 */
export function defaultPlacement(options: AssignmentOptions, previousFacilityId?: string): { facilityId: string; zoneId: string } {
  const facility = options.facilities.find((f) => f.id === previousFacilityId) ?? options.facilities[0];
  return { facilityId: facility?.id ?? '', zoneId: facility?.zones[0]?.id ?? '' };
}

/** Shown when a reassignment changes organization: history is not moved, so say where it stays. */
export function describeReassignImpact(input: { currentOrgId: string | null; currentOrgName: string | null; nextOrgId: string }): string | null {
  if (!input.nextOrgId || !input.currentOrgId || input.nextOrgId === input.currentOrgId) return null;
  return `Readings recorded so far stay with ${input.currentOrgName ?? 'the current organization'}; the new organization sees only readings from now on.`;
}

/**
 * The facility and zone to show for the current choices, derived during render
 * (so there is no effect to fall out of sync when the organization changes and
 * its options load). The facility is the chosen one if the options contain it,
 * otherwise the first — including when it was never chosen at all. The zone is
 * the chosen one if THAT facility has it, otherwise its first, so a zone picked
 * before touching the facility sticks, and one left over from another
 * organization's facility never does.
 */
export function resolvePlacement(options: AssignmentOptions, facilityId: string, zoneId: string): { facilityId: string; zoneId: string } {
  const facility = options.facilities.find((f) => f.id === facilityId) ?? options.facilities[0];
  if (!facility) return { facilityId: '', zoneId: '' };
  const zone = facility.zones.find((z) => z.id === zoneId) ?? facility.zones[0];
  return { facilityId: facility.id, zoneId: zone?.id ?? '' };
}
