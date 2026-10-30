import type { AdminDeviceStatus } from '@bin-tracker/types';

export type BadgeTone = 'good' | 'warn' | 'alert' | 'idle' | 'pending';

/**
 * Badge tone for a device's health on the admin screens. A device with no
 * reading (WAITING/UNKNOWN) is never green: "nothing reported" is not "OK".
 */
export function adminStatusTone(status: AdminDeviceStatus): BadgeTone {
  switch (status) {
    case 'OK':
      return 'good';
    case 'WARN':
    case 'OFFLINE':
      return 'warn';
    case 'ALERT':
    case 'FAULT':
      return 'alert';
    case 'WAITING':
      return 'pending';
    case 'UNKNOWN':
      return 'idle';
  }
}

export type DeviceState = 'UNASSIGNED' | 'ACTIVE' | 'DEACTIVATED';

export function stateTone(state: DeviceState): BadgeTone {
  switch (state) {
    case 'ACTIVE':
      return 'good';
    case 'UNASSIGNED':
      return 'pending';
    case 'DEACTIVATED':
      return 'idle';
  }
}
