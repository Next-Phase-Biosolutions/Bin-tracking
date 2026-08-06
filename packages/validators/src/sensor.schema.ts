import { z } from 'zod';

// ─── List Devices ──────────────────────────────────────────────

export const listDevicesSchema = z.object({ facilityId: z.string().optional() });

export type ListDevicesInput = z.infer<typeof listDevicesSchema>;

// ─── Sensor Reading Range ──────────────────────────────────────

export const sensorReadingRangeSchema = z.object({
    deviceId: z.string(),
    range: z.enum(['24h', '7d']).default('24h'),
});

export type SensorReadingRangeInput = z.infer<typeof sensorReadingRangeSchema>;
