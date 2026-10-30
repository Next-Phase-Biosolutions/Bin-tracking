import { describe, expect, it } from 'vitest';
import { facilitiesWithZone, resolveZoneFacility, zoneViewMode } from './zone-view';

const z = (id: string, slug: string, facilityId: string, facilityName: string) => ({ id, slug, facilityId, facilityName });
const zones = [
  z('z1', 'wetaging', 'fac-b', 'Beta Plant'),
  z('z2', 'wetaging', 'fac-a', 'Alpha Plant'),
  z('z3', 'receiving', 'fac-a', 'Alpha Plant'),
];

describe('resolveZoneFacility', () => {
  it('uses the requested facility when it has the slug', () => {
    expect(resolveZoneFacility(zones, 'wetaging', 'fac-b')?.id).toBe('z1');
  });

  it('falls back to the first facility by name when the request is foreign or absent', () => {
    expect(resolveZoneFacility(zones, 'wetaging', 'fac-x')?.id).toBe('z2');
    expect(resolveZoneFacility(zones, 'wetaging', null)?.id).toBe('z2');
  });

  it('falls back when the requested facility has no zone with that slug', () => {
    expect(resolveZoneFacility(zones, 'receiving', 'fac-b')?.id).toBe('z3');
  });

  it('returns undefined for a slug nobody has', () => {
    expect(resolveZoneFacility(zones, 'nope', null)).toBeUndefined();
  });
});

describe('facilitiesWithZone', () => {
  it('lists each facility that has the slug, by name — for the switcher', () => {
    expect(facilitiesWithZone(zones, 'wetaging')).toEqual([
      { id: 'fac-a', name: 'Alpha Plant' },
      { id: 'fac-b', name: 'Beta Plant' },
    ]);
    expect(facilitiesWithZone(zones, 'receiving')).toHaveLength(1);
  });
});

describe('zoneViewMode', () => {
  it('shows the sensor view for any zone with a device', () => {
    for (const slug of ['wetaging', 'receiving', 'coldroom']) {
      expect(zoneViewMode({ slug, hasDevice: true })).toBe('sensor');
    }
  });

  it('keeps the mock layout for killfloor and wetaging without a device', () => {
    expect(zoneViewMode({ slug: 'killfloor', hasDevice: false })).toBe('mock');
    expect(zoneViewMode({ slug: 'wetaging', hasDevice: false })).toBe('mock');
  });

  it('keeps the "Not accessible" placeholder for the other four built-in zones without a device', () => {
    for (const slug of ['receiving', 'processing', 'valueadd', 'shipping']) {
      expect(zoneViewMode({ slug, hasDevice: false })).toBe('placeholder');
    }
  });

  it('shows the generic "no sensor assigned" view for an admin-created zone without a device', () => {
    expect(zoneViewMode({ slug: 'coldroom', hasDevice: false })).toBe('generic');
  });
});
