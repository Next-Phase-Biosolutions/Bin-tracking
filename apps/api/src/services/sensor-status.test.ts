import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFLINE_AFTER_MINUTES, isDeviceOnline } from '@bin-tracker/types';

const NOW = new Date('2026-10-30T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe('isDeviceOnline', () => {
  it('defaults the offline threshold to 20 minutes', () => {
    expect(DEFAULT_OFFLINE_AFTER_MINUTES).toBe(20);
  });

  it('is online when last seen within the threshold, inclusive of the boundary', () => {
    expect(isDeviceOnline(minutesAgo(5), NOW, 20)).toBe(true);
    expect(isDeviceOnline(minutesAgo(20), NOW, 20)).toBe(true);
  });

  it('is offline once past the threshold', () => {
    expect(isDeviceOnline(minutesAgo(21), NOW, 20)).toBe(false);
  });

  it('is offline when it has never been seen', () => {
    expect(isDeviceOnline(null, NOW, 20)).toBe(false);
  });

  it('treats a lastSeenAt slightly in the future (device clock skew) as online', () => {
    expect(isDeviceOnline(new Date(NOW.getTime() + 60_000), NOW, 20)).toBe(true);
  });
});
