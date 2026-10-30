import { computeThresholdStatus, type ThresholdStatus } from './sensor-thresholds.js';

/**
 * How long a device may stay silent before it counts as offline. The real send
 * interval is unconfirmed (see docs/sensor-push-ingest/OPEN_ITEMS.md #3), so the
 * default is conservative and platform admins can change it.
 */
export const DEFAULT_OFFLINE_AFTER_MINUTES = 20;

/** Online = seen within the threshold (inclusive). Never seen = offline. A slightly-future lastSeenAt (device clock skew) is online. */
export function isDeviceOnline(lastSeenAt: Date | null, now: Date, offlineAfterMinutes: number): boolean {
    if (lastSeenAt === null) return false;
    return now.getTime() - lastSeenAt.getTime() <= offlineAfterMinutes * 60_000;
}

/** What a platform admin sees on a device: threshold health plus the states a tenant never sees. */
export type AdminDeviceStatus = 'WAITING' | 'OFFLINE' | 'FAULT' | ThresholdStatus;

/**
 * Precedence: never reported -> WAITING; silent past the threshold -> OFFLINE;
 * a non-zero error code on the latest reading -> FAULT; otherwise the threshold
 * status. OFFLINE outranks FAULT because a stale reading's fault is history.
 */
export function adminDeviceStatus(input: {
    lastSeenAt: Date | null;
    latest: { tempC: number | null; humidityPct: number | null; nh3Ppm: number | null; errorCode: number | null } | null;
    now: Date;
    offlineAfterMinutes: number;
}): AdminDeviceStatus {
    if (input.latest === null) return 'WAITING';
    if (!isDeviceOnline(input.lastSeenAt, input.now, input.offlineAfterMinutes)) return 'OFFLINE';
    if (input.latest.errorCode !== null && input.latest.errorCode !== 0) return 'FAULT';
    return computeThresholdStatus({
        tempC: input.latest.tempC,
        humidityPct: input.latest.humidityPct,
        nh3Ppm: input.latest.nh3Ppm,
    });
}
