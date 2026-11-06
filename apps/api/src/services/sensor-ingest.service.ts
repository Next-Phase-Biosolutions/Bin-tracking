import { prisma, type Prisma } from '@bin-tracker/db';
import { SENSOR_DATA_NUMERIC_KEYS, type IngestSensorReadingInput } from '@bin-tracker/validators';
import { unknownDeviceLog } from './unknown-device-log.service.js';

/** The device_id isn't registered, or its device has been deactivated. */
export class UnknownSensorDeviceError extends Error {
  constructor(externalId: string) {
    super(`unknown device: ${externalId}`);
    this.name = 'UnknownSensorDeviceError';
  }
}

/**
 * Temperature and humidity for a reading: `p_data.temp_c` / `p_data.humidity_pct` when sent
 * (the schema guarantees they are numbers), else the older `p_temp_c` / `p_humidity_pct`.
 * `unmapped` holds every other `p_data` key so a new sensor's values are kept, not dropped.
 */
export function resolveReadingMetrics(input: IngestSensorReadingInput): {
  tempC: number | null;
  humidityPct: number | null;
  unmapped: Record<string, unknown>;
} {
  const data = input.p_data ?? {};
  const unmapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!(SENSOR_DATA_NUMERIC_KEYS as readonly string[]).includes(key)) unmapped[key] = value;
  }
  return {
    tempC: (data['temp_c'] as number | null | undefined) ?? input.p_temp_c ?? null,
    humidityPct: (data['humidity_pct'] as number | null | undefined) ?? input.p_humidity_pct ?? null,
    unmapped,
  };
}

export const sensorIngestService = {
  /**
   * Stores one pushed reading. The tenant is derived from the pre-registered
   * SensorDevice (looked up by its externalId), never from the payload — the
   * shared ingest key identifies no tenant. UNASSIGNED devices are stored too
   * (organizationId null) so an admin can confirm data is arriving before
   * assigning; DEACTIVATED and unregistered ids write nothing.
   */
  async ingest(input: IngestSensorReadingInput, now: Date = new Date()): Promise<void> {
    const { tempC, humidityPct, unmapped } = resolveReadingMetrics(input);
    const device = await prisma.sensorDevice.findUnique({
      where: { externalId: input.p_device_id },
      select: { id: true, state: true, organizationId: true },
    });
    if (!device) {
      await unknownDeviceLog.record(input.p_device_id, now, {
        tempC,
        humidityPct,
        raw: input.p_raw,
      });
      throw new UnknownSensorDeviceError(input.p_device_id);
    }
    // Same response as an unregistered id (the firmware contract has no 403/410).
    if (device.state === 'DEACTIVATED') throw new UnknownSensorDeviceError(input.p_device_id);

    const timestamp = input.p_timestamp ? new Date(input.p_timestamp) : now;

    await prisma.$transaction([
      // (deviceId, timestamp) is unique: a device retry collapses, not duplicates.
      prisma.sensorReading.createMany({
        data: [
          {
            deviceId: device.id,
            // Stamped now so reassigning the device later never moves this reading to another tenant.
            organizationId: device.organizationId,
            timestamp,
            tempC,
            humidityPct,
            rssi: input.p_rssi ?? null,
            snr: input.p_snr ?? null,
            filteredRssi: input.p_filtered_rssi ?? null,
            errorCode: input.p_error_code ?? null,
            errorMessage: input.p_error_message ?? null,
            rawPayload: (Object.keys(unmapped).length > 0
              ? { ...input.p_raw, p_data_unmapped: unmapped }
              : input.p_raw) as Prisma.InputJsonObject,
          },
        ],
        skipDuplicates: true,
      }),
      // Only ever move lastSeenAt forward — a late, older reading must not rewind it.
      prisma.sensorDevice.updateMany({
        where: { id: device.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: timestamp } }] },
        data: { lastSeenAt: timestamp },
      }),
    ]);
  },
};
