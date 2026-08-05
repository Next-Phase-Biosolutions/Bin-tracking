/**
 * Nothing in the schema itself enforces that a SensorDevice's organizationId
 * matches its facility's organizationId — Prisma's relation only requires the
 * facilityId to point at a real row, not one owned by the same org. Call this
 * at every SensorDevice creation/mapping site (backfill script provisioning,
 * future admin UI) before the write, so a mismatched org is rejected instead
 * of silently persisted.
 */
export function assertSensorDeviceOrgConsistency(
    device: { organizationId: string },
    facility: { organizationId: string },
): void {
    if (device.organizationId !== facility.organizationId) {
        throw new Error(
            `SensorDevice.organizationId (${device.organizationId}) does not match facility.organizationId (${facility.organizationId})`,
        );
    }
}
