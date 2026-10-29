import { describe, expect, it } from 'vitest';
import { pickZoneDevice } from './zone-sensors';

const d = (id: string, zone: string | null, lastSeenAt: Date | null) => ({ id, zone, lastSeenAt });

describe('pickZoneDevice', () => {
  it('returns undefined when no device is assigned to the zone', () => {
    expect(pickZoneDevice([d('a', 'killfloor', new Date())], 'wetaging')).toBeUndefined();
    expect(pickZoneDevice([], 'wetaging')).toBeUndefined();
  });

  it('ignores devices with no zone assigned', () => {
    expect(pickZoneDevice([d('a', null, new Date())], 'wetaging')).toBeUndefined();
  });

  it('returns the device assigned to the zone', () => {
    const devices = [d('a', 'killfloor', new Date()), d('b', 'wetaging', new Date())];
    expect(pickZoneDevice(devices, 'wetaging')?.id).toBe('b');
  });

  it('prefers the most recently reporting device when several share a zone', () => {
    const devices = [
      d('old', 'wetaging', new Date('2026-10-29T08:00:00Z')),
      d('new', 'wetaging', new Date('2026-10-29T11:00:00Z')),
      d('mid', 'wetaging', new Date('2026-10-29T09:00:00Z')),
    ];
    expect(pickZoneDevice(devices, 'wetaging')?.id).toBe('new');
  });

  it('ranks a device that has never reported below one that has', () => {
    const devices = [d('silent', 'wetaging', null), d('live', 'wetaging', new Date('2026-10-29T08:00:00Z'))];
    expect(pickZoneDevice(devices, 'wetaging')?.id).toBe('live');
  });

  it('still returns a never-reported device when it is the only one', () => {
    expect(pickZoneDevice([d('silent', 'wetaging', null)], 'wetaging')?.id).toBe('silent');
  });
});
