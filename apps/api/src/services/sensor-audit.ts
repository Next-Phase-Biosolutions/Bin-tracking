import type { Prisma } from '@bin-tracker/db';

export const SENSOR_AUDIT_ACTIONS = [
  'device.add',
  'device.assign',
  'device.reassign',
  'device.zone_change',
  'device.deactivate',
  'device.reactivate',
] as const;

export type SensorAuditAction = (typeof SENSOR_AUDIT_ACTIONS)[number];

/**
 * Appends one audit row (who, what, when). Always called inside the same
 * transaction as the change it records, so there is never a change without its
 * entry, nor an entry for a change that rolled back. Same shape as PayrollAuditLog.
 */
export async function writeSensorAudit(
  tx: Prisma.TransactionClient,
  entry: { deviceId: string; actorId: string; action: SensorAuditAction; oldValue?: unknown; newValue?: unknown },
): Promise<void> {
  await tx.sensorDeviceAuditLog.create({
    data: {
      deviceId: entry.deviceId,
      actorId: entry.actorId,
      action: entry.action,
      oldValue: entry.oldValue as Prisma.InputJsonValue | undefined,
      newValue: entry.newValue as Prisma.InputJsonValue | undefined,
    },
  });
}
