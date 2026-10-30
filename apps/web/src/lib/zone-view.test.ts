import { describe, expect, it } from 'vitest';
import { facilitiesWithZone, resolveZoneFacility, sensorCountsByFacility, zonePageState, zoneViewMode } from './zone-view';

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

  it('opens on a facility whose zone has a sensor when none was requested, instead of the first by name', () => {
    const counts = new Map([['fac-b', 1]]);
    expect(resolveZoneFacility(zones, 'wetaging', null, counts)?.id).toBe('z1');
    expect(resolveZoneFacility(zones, 'wetaging', 'fac-x', counts)?.id).toBe('z1');
  });

  it('still honours an explicit facility choice, even one without a sensor', () => {
    const counts = new Map([['fac-b', 1]]);
    expect(resolveZoneFacility(zones, 'wetaging', 'fac-a', counts)?.id).toBe('z2');
  });

  it('breaks a tie between facilities that both have sensors by name', () => {
    const counts = new Map([['fac-a', 1], ['fac-b', 3]]);
    expect(resolveZoneFacility(zones, 'wetaging', null, counts)?.id).toBe('z2');
  });
});

describe('sensorCountsByFacility', () => {
  const device = (facilityId: string, slug: string | null) => ({ facility: { id: facilityId }, zone: slug ? { slug } : null });

  it('counts devices per facility for the given zone slug only', () => {
    const counts = sensorCountsByFacility(
      [device('fac-a', 'wetaging'), device('fac-a', 'wetaging'), device('fac-b', 'killfloor'), device('fac-b', null)],
      'wetaging',
    );
    expect([...counts]).toEqual([['fac-a', 2]]);
  });

  it('is empty before the device list has loaded', () => {
    expect(sensorCountsByFacility(undefined, 'wetaging').size).toBe(0);
  });
});

describe('facilitiesWithZone', () => {
  it('lists each facility that has the slug, by name — for the switcher', () => {
    expect(facilitiesWithZone(zones, 'wetaging')).toEqual([
      { id: 'fac-a', name: 'Alpha Plant', sensorCount: 0 },
      { id: 'fac-b', name: 'Beta Plant', sensorCount: 0 },
    ]);
    expect(facilitiesWithZone(zones, 'receiving')).toHaveLength(1);
  });

  it('carries each facility\'s sensor count, so the switcher can say where the sensors are', () => {
    expect(facilitiesWithZone(zones, 'wetaging', new Map([['fac-b', 2]])).map((f) => f.sensorCount)).toEqual([0, 2]);
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

describe('zonePageState', () => {
  const base = { zonesLoading: false, zonesError: false, devicesLoading: false, hasZone: true };

  it('waits while zones or devices load, so a valid link is never redirected or flashed with mock data', () => {
    expect(zonePageState({ ...base, zonesLoading: true, hasZone: false })).toBe('loading');
    expect(zonePageState({ ...base, devicesLoading: true })).toBe('loading');
  });

  it('shows an error — not a redirect — when the zones query failed', () => {
    expect(zonePageState({ ...base, zonesError: true, hasZone: false })).toBe('error');
  });

  it('redirects only when the zones loaded fine and this slug is not among them', () => {
    expect(zonePageState({ ...base, hasZone: false })).toBe('missing');
  });

  it('is ready once the zone is known', () => {
    expect(zonePageState(base)).toBe('ready');
  });

  it('a failed devices query does not block the page (the zone just has no sensor)', () => {
    expect(zonePageState({ ...base, devicesLoading: false })).toBe('ready');
  });
});
