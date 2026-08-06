/**
 * Seeds a SYNTHETIC sensor device and reading history for local UI work.
 *
 * This is not vendor data. `backfill-sensors.ts` is the real ingestion path;
 * it needs EcoSafeSense credentials, which not every dev has. This script
 * exists so the environment cards on the facility-zone pages can be built and
 * verified without them.
 *
 * Values are shaped like a wet-aging cooler rather than like the demo device's
 * actual readings (which sit at room temperature, ~24-34 °C, and therefore
 * compute to ALERT on every single row). The drift here deliberately crosses
 * SENSOR_THRESHOLDS' warn boundaries so OK/WARN/ALERT all actually appear.
 *
 * Run: pnpm --filter @bin-tracker/db seed:sensor-demo
 */
import { prisma } from './client.js';
import { assertSensorDeviceOrgConsistency } from './assert-sensor-device-org.js';
import { setModuleOverride } from './module-service.js';

const EXTERNAL_ID = 'demo-wetaging-0001';
const LABEL = 'Wet Aging Cooler Sensor (demo)';
const HISTORY_HOURS = 48;
const INTERVAL_MINUTES = 10;

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Refuses to run against anything but a local database. This script writes
 * hundreds of rows and flips a module on — both things that must never land in
 * a Supabase project by accident because a .env still pointed at one.
 *
 * Parses the actual hostname rather than substring-matching the raw URL — a
 * substring check accepts `@localhost.example.com` (a real, different host)
 * as a false pass. Does NOT catch an SSH-tunneled remote DB forwarded to
 * localhost — a connection string alone can't distinguish that from a real
 * local Postgres, since to Postgres both look identical.
 */
function assertLocalDatabase(): void {
  const url = process.env['DATABASE_URL'] ?? '';
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(
      `refusing to run: DATABASE_URL is not local. This script seeds fake sensor data and is local-only.\n` +
        `Point DATABASE_URL at localhost first.`,
    );
  }
}

/** One reading, drifting on a slow daily cycle with a little noise on top. */
function syntheticReading(timestamp: Date, index: number) {
  const phase = (index / ((60 / INTERVAL_MINUTES) * 24)) * Math.PI * 2;
  const noise = (scale: number) => (Math.random() - 0.5) * scale;

  return {
    timestamp,
    // Centred at 3.2 °C, swinging ±1.6 — dips under the 2 °C warn floor on
    // the cold part of each cycle so the status badge is not a constant.
    tempC: Number((3.2 + Math.sin(phase) * 1.6 + noise(0.3)).toFixed(2)),
    // Straddles the 70 % warn ceiling for the same reason.
    humidityPct: Number((68 + Math.cos(phase) * 4 + noise(1.2)).toFixed(2)),
    nh3Ppm: Number((0.05 + noise(0.04)).toFixed(4)),
    tvoc: Math.round(60 + Math.sin(phase) * 40 + noise(20)),
    eco2Ppm: Math.round(480 + Math.sin(phase) * 120 + noise(40)),
    aqhiPlus: Math.max(1, Math.round(2 + noise(1.5))),
    ozonePpb: Math.max(0, Math.round(12 + noise(10))),
    pressure: Number((1001 + Math.sin(phase) * 6 + noise(1.5)).toFixed(2)),
    pm25: Math.max(0, Math.round(7 + noise(6))),
  };
}

async function main(): Promise<void> {
  assertLocalDatabase();

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: 'default' } });
  const facility = await prisma.facility.findFirstOrThrow({
    where: { organizationId: org.id, deletedAt: null },
  });

  await setModuleOverride(prisma, {
    orgId: org.id,
    module: 'ENVIRONMENT_MONITORING',
    enabled: true,
    updatedBy: 'seed-sensor-demo',
  });

  assertSensorDeviceOrgConsistency({ organizationId: org.id }, facility);
  const device = await prisma.sensorDevice.upsert({
    where: { externalId: EXTERNAL_ID },
    update: {},
    create: {
      externalId: EXTERNAL_ID,
      organizationId: org.id,
      facilityId: facility.id,
      label: LABEL,
    },
  });

  const count = (HISTORY_HOURS * 60) / INTERVAL_MINUTES;
  const now = Date.now();
  const readings = Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(now - (count - 1 - i) * INTERVAL_MINUTES * 60_000);
    return { ...syntheticReading(timestamp, i), deviceId: device.id };
  });

  // Same dedup mechanism the real backfill uses, so re-running is a no-op.
  const result = await prisma.sensorReading.createMany({ data: readings, skipDuplicates: true });
  const newest = readings[readings.length - 1]!.timestamp;
  await prisma.sensorDevice.update({ where: { id: device.id }, data: { lastSeenAt: newest } });

  console.log(`org:        ${org.slug}`);
  console.log(`facility:   ${facility.name} (${facility.id})`);
  console.log(`device:     ${device.label}`);
  console.log(`externalId: ${device.externalId}   <- set VITE_ZONE_SENSOR_WETAGING to this`);
  console.log(
    `readings:   ${result.count} inserted, ${readings.length - result.count} already present`,
  );
  console.log(`lastSeenAt: ${newest.toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
