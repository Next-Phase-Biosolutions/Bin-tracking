import { describe, expect, it } from 'vitest';
import { defaultPlacement, describeReassignImpact, isAssignmentComplete, otherDevicesInZone, resolvePlacement } from './assignment';

const options = {
  moduleEnabled: true,
  facilities: [
    {
      id: 'fac-a',
      name: 'Alpha',
      zones: [
        { id: 'z1', name: 'Receiving', slug: 'receiving', devices: [] },
        { id: 'z2', name: 'Wet Aging', slug: 'wetaging', devices: [{ id: 'd1', name: 'Cooler A' }, { id: 'd2', name: 'Warm room' }] },
      ],
    },
    { id: 'fac-b', name: 'Beta', zones: [{ id: 'z3', name: 'Receiving', slug: 'receiving', devices: [] }] },
    { id: 'fac-empty', name: 'Empty', zones: [] },
  ],
};

describe('isAssignmentComplete', () => {
  const full = { organizationId: 'o', facilityId: 'f', zoneId: 'z', name: 'Cooler 1' };

  it('needs an org, facility, zone and a name', () => {
    expect(isAssignmentComplete(full)).toBe(true);
    for (const key of ['organizationId', 'facilityId', 'zoneId', 'name'] as const) {
      expect(isAssignmentComplete({ ...full, [key]: '' })).toBe(false);
    }
  });

  it('treats a blank-looking name as missing and rejects one over 80 characters', () => {
    expect(isAssignmentComplete({ ...full, name: '   ' })).toBe(false);
    expect(isAssignmentComplete({ ...full, name: 'x'.repeat(80) })).toBe(true);
    expect(isAssignmentComplete({ ...full, name: 'x'.repeat(81) })).toBe(false);
  });
});

describe('defaultPlacement', () => {
  it("picks the org's first facility and that facility's first zone", () => {
    expect(defaultPlacement(options)).toEqual({ facilityId: 'fac-a', zoneId: 'z1' });
  });

  it('keeps a facility that still exists, resetting the zone to its first', () => {
    expect(defaultPlacement(options, 'fac-b')).toEqual({ facilityId: 'fac-b', zoneId: 'z3' });
  });

  it('falls back when the previous facility is not in the new org', () => {
    expect(defaultPlacement(options, 'someone-elses')).toEqual({ facilityId: 'fac-a', zoneId: 'z1' });
  });

  it('leaves the zone empty for a facility with no zones, and everything empty for an org with no facilities', () => {
    expect(defaultPlacement(options, 'fac-empty')).toEqual({ facilityId: 'fac-empty', zoneId: '' });
    expect(defaultPlacement({ moduleEnabled: true, facilities: [] })).toEqual({ facilityId: '', zoneId: '' });
  });
});

describe('describeReassignImpact', () => {
  it('warns that earlier readings stay with the current org when the org changes', () => {
    const message = describeReassignImpact({ currentOrgId: 'o1', currentOrgName: 'Alpha Co', nextOrgId: 'o2' });
    expect(message).toContain('Alpha Co');
    expect(message).toMatch(/stay/i);
  });

  it('has no warning when the org is unchanged or nothing is selected yet', () => {
    expect(describeReassignImpact({ currentOrgId: 'o1', currentOrgName: 'Alpha Co', nextOrgId: 'o1' })).toBeNull();
    expect(describeReassignImpact({ currentOrgId: 'o1', currentOrgName: 'Alpha Co', nextOrgId: '' })).toBeNull();
  });
});

describe('resolvePlacement', () => {
  it('keeps a facility and zone that are still valid for the options', () => {
    expect(resolvePlacement(options, 'fac-a', 'z2')).toEqual({ facilityId: 'fac-a', zoneId: 'z2' });
  });

  it("resets the zone to the facility's first when the chosen zone is not in that facility", () => {
    expect(resolvePlacement(options, 'fac-a', 'z3')).toEqual({ facilityId: 'fac-a', zoneId: 'z1' });
  });

  it('falls back to defaults when the chosen facility is not in the options (the org changed)', () => {
    expect(resolvePlacement(options, 'other-orgs-facility', 'zzz')).toEqual({ facilityId: 'fac-a', zoneId: 'z1' });
  });

  // Regression (found end-to-end): the admin never touches the Facility dropdown, so the stored
  // facility is '' while the form SHOWS the first one. Choosing a zone must still stick.
  it("keeps the admin's zone choice when the facility was never chosen and is derived as the first", () => {
    expect(resolvePlacement(options, '', 'z2')).toEqual({ facilityId: 'fac-a', zoneId: 'z2' });
  });

  it("does not carry a zone over from a different facility's list", () => {
    expect(resolvePlacement(options, '', 'z3')).toEqual({ facilityId: 'fac-a', zoneId: 'z1' });
  });

  it('is empty for an org with no facilities', () => {
    expect(resolvePlacement({ moduleEnabled: false, facilities: [] }, 'x', 'y')).toEqual({ facilityId: '', zoneId: '' });
  });
});

describe('isAssignmentComplete — the name must not be the hardware id', () => {
  const full = { organizationId: 'o', facilityId: 'f', zoneId: 'z', name: 'Cooler 1' };

  it('blocks submission when the name is the device id', () => {
    expect(isAssignmentComplete({ ...full, name: 'MT-0001' }, 'MT-0001')).toBe(false);
    expect(isAssignmentComplete({ ...full, name: ' mt-0001' }, 'MT-0001')).toBe(false);
  });

  it('allows a real name, and still works without an id to compare against', () => {
    expect(isAssignmentComplete(full, 'MT-0001')).toBe(true);
    expect(isAssignmentComplete(full)).toBe(true);
  });
});

describe('otherDevicesInZone', () => {
  it('names the devices already in the chosen zone, so the admin is warned before adding a second', () => {
    expect(otherDevicesInZone(options, 'fac-a', 'z2')).toEqual(['Cooler A', 'Warm room']);
  });

  it('leaves out the device being edited, so keeping it in its own zone is not a warning', () => {
    expect(otherDevicesInZone(options, 'fac-a', 'z2', 'd1')).toEqual(['Warm room']);
  });

  it('is empty for an empty zone and for an unknown facility or zone', () => {
    expect(otherDevicesInZone(options, 'fac-a', 'z1')).toEqual([]);
    expect(otherDevicesInZone(options, 'nope', 'z1')).toEqual([]);
    expect(otherDevicesInZone(options, 'fac-a', 'nope')).toEqual([]);
  });
});
