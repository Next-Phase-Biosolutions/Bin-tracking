import { describe, expect, it } from 'vitest';
import { adminDeviceStatus, DEFAULT_OFFLINE_AFTER_MINUTES, isDeviceOnline, SENSOR_THRESHOLDS } from '@bin-tracker/types';

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

describe('adminDeviceStatus', () => {
  const fresh = minutesAgo(1);
  const reading = (over: Partial<{ tempC: number | null; humidityPct: number | null; nh3Ppm: number | null; errorCode: number | null }> = {}) => ({
    tempC: 5,
    humidityPct: 50, // inside every threshold band: a truly nominal reading
    nh3Ppm: null,
    errorCode: null,
    ...over,
  });
  const status = (lastSeenAt: Date | null, latest: ReturnType<typeof reading> | null) =>
    adminDeviceStatus({ lastSeenAt, latest, now: NOW, offlineAfterMinutes: 20 });

  it('is WAITING when the device has never reported', () => {
    expect(status(null, null)).toBe('WAITING');
  });

  it('is OFFLINE once it has been silent past the threshold, even if its last reading was a fault', () => {
    expect(status(minutesAgo(60), reading({ errorCode: 100 }))).toBe('OFFLINE');
  });

  it('is FAULT for a non-zero error code, ahead of any threshold status', () => {
    expect(status(fresh, reading({ errorCode: 100, tempC: SENSOR_THRESHOLDS.temp.alertHigh + 5 }))).toBe('FAULT');
  });

  it('does not treat error code 0 as a fault', () => {
    expect(status(fresh, reading({ errorCode: 0 }))).toBe('OK');
  });

  it('falls through to the threshold status when online and fault-free', () => {
    expect(status(fresh, reading({ tempC: SENSOR_THRESHOLDS.temp.alertHigh + 1 }))).toBe('ALERT');
    expect(status(fresh, reading({ tempC: SENSOR_THRESHOLDS.temp.warnHigh + 1 }))).toBe('WARN');
  });

  it('is UNKNOWN when online and fault-free but nothing was measured', () => {
    expect(status(fresh, reading({ tempC: null, humidityPct: null }))).toBe('UNKNOWN');
  });
});
