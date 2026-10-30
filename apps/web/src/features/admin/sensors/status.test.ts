import { describe, expect, it } from 'vitest';
import type { AdminDeviceStatus } from '@bin-tracker/types';
import { adminStatusTone, stateTone } from './status';

describe('adminStatusTone', () => {
  it('maps every admin status to a badge tone', () => {
    const expected: Record<AdminDeviceStatus, string> = {
      OK: 'good',
      WARN: 'warn',
      ALERT: 'alert',
      FAULT: 'alert',
      OFFLINE: 'warn',
      WAITING: 'pending',
      UNKNOWN: 'idle',
    };
    for (const [status, tone] of Object.entries(expected)) {
      expect(adminStatusTone(status as AdminDeviceStatus)).toBe(tone);
    }
  });

  it('never shows UNKNOWN or WAITING as green — a device with no reading is not "OK"', () => {
    expect(adminStatusTone('UNKNOWN')).not.toBe('good');
    expect(adminStatusTone('WAITING')).not.toBe('good');
  });
});

describe('stateTone', () => {
  it('maps every device state', () => {
    expect(stateTone('ACTIVE')).toBe('good');
    expect(stateTone('UNASSIGNED')).toBe('pending');
    expect(stateTone('DEACTIVATED')).toBe('idle');
  });
});
