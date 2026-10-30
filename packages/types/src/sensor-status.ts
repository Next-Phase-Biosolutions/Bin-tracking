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
