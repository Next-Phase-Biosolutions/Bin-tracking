import { pathToFileURL } from 'node:url';
import { prisma } from './client.js';
import { assertSensorDeviceOrgConsistency } from './assert-sensor-device-org.js';
import { EcoSafeSenseClient } from './ecosafesense.client.js';

/**
 * Historical backfill + 10-min repeat poll for EcoSafeSense sensor data
 * (docs/sensor-integration/03_backfill_script.md). Demo-scoped stand-in for
 * a future BullMQ worker — a plain interval loop, not production
 * infrastructure. Meant to run under `nohup ... &` for the demo window (see
 * "How To Test" in the doc); does not exit on its own.
 *
 * Does NOT compute or store threshold status — that's read-time only, via
 * the service layer (Action Item 4, a separate file this script must not
 * import from). Does NOT sanity-check thresholds against backfilled data —
 * that's done manually, out of band, not by this script.
 */

// Vendor confirmed (Aug 5 call) 5-10 min is within their rate limit — do not
// lower without re-confirming.
const POLL_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_BACKFILL_LOOKBACK_DAYS = 30;

export interface Config {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    deviceExternalId: string;
    deviceLabel: string;
    orgSlug: string;
    facilityId: string;
    backfillLookbackDays: number;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`missing required env var ${name}`);
    return value;
}

export function loadConfig(): Config {
    const deviceExternalId = requireEnv('ECOSAFESENSE_DEVICE_ID');
    return {
        baseUrl: requireEnv('ECOSAFESENSE_BASE_URL'),
        clientId: requireEnv('ECOSAFESENSE_CLIENT_ID'),
        clientSecret: requireEnv('ECOSAFESENSE_CLIENT_SECRET'),
        deviceExternalId,
        deviceLabel: process.env['SENSOR_DEVICE_LABEL'] ?? `EcoSafeSense ${deviceExternalId}`,
        orgSlug: process.env['SENSOR_ORG_SLUG'] ?? 'default',
        facilityId: requireEnv('SENSOR_FACILITY_ID'),
        backfillLookbackDays: Number(process.env['ECOSAFESENSE_BACKFILL_LOOKBACK_DAYS'] ?? DEFAULT_BACKFILL_LOOKBACK_DAYS),
    };
}

/**
 * This script is the only place a SensorDevice actually gets created, so
 * the org-consistency assertion (Action Item 1, step 5) has to live here,
 * checked before the write — not just stated as a requirement elsewhere.
 */
export async function provisionDevice(config: Config) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: config.orgSlug } });
    const facility = await prisma.facility.findUniqueOrThrow({ where: { id: config.facilityId } });

    assertSensorDeviceOrgConsistency({ organizationId: org.id }, facility);

    return prisma.sensorDevice.upsert({
        where: { externalId: config.deviceExternalId },
        update: {},
        create: {
            externalId: config.deviceExternalId,
            organizationId: org.id,
            facilityId: facility.id,
            label: config.deviceLabel,
        },
    });
}

/**
 * One backfill/poll cycle: fetch everything since the last row we
 * successfully inserted (inclusive `from`), insert unaveraged/as-is, and
 * always advance `lastSeenAt` — even on a zero-row cycle, so staleness is
 * measurable (Action Item 1, step 4).
 *
 * Dedup: the schema carries `@@unique([deviceId, timestamp])` (Action Item
 * 1's option (b), vendor-confirmed only genuinely-junk Wi-Fi-setup rows
 * collide) — `createMany({ skipDuplicates: true })` is the entire dedup
 * mechanism. No in-memory dedup here; that's option (a)'s approach, not
 * this schema's.
 */
export async function runCycle(
    client: Pick<EcoSafeSenseClient, 'fetchReadings'>,
    deviceId: string,
    config: Config,
): Promise<void> {
    const device = await prisma.sensorDevice.findUniqueOrThrow({ where: { id: deviceId } });

    const lastRow = await prisma.sensorReading.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
    });
    // Inclusive `from` — using `>` instead would silently drop legitimate
    // rows in the boundary timestamp cluster. skipDuplicates absorbs the
    // resulting overlap at that boundary.
    const from = lastRow?.timestamp ?? new Date(Date.now() - config.backfillLookbackDays * 24 * 60 * 60 * 1000);
    const to = new Date();

    console.log(`[backfill-sensors] cycle start: device=${device.externalId} from=${from.toISOString()} to=${to.toISOString()}`);

    const { readings, fieldsUsed } = await client.fetchReadings(device.externalId, from, to);

    if (readings.length === 0) {
        // Both real devices are currently offline — this is expected during
        // most of the demo window, not an error.
        console.log('[backfill-sensors] cycle done: 0 new rows (device offline or fully caught up) — lastSeenAt unchanged');
        await prisma.sensorDevice.update({ where: { id: device.id }, data: { lastSeenAt: device.lastSeenAt } });
        return;
    }

    // Insert unaveraged, as-is — do not collapse same-timestamp clusters here.
    const result = await prisma.sensorReading.createMany({
        data: readings.map((r) => ({ ...r, deviceId: device.id })),
        skipDuplicates: true,
    });

    const newestTimestamp = readings.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), readings[0]!.timestamp);
    await prisma.sensorDevice.update({ where: { id: device.id }, data: { lastSeenAt: newestTimestamp } });

    console.log(
        `[backfill-sensors] cycle done: fetched=${readings.length} inserted=${result.count} ` +
            `skipped_duplicates=${readings.length - result.count} fields=${fieldsUsed.join(',')} lastSeenAt=${newestTimestamp.toISOString()}`,
    );
}

async function main(): Promise<void> {
    const config = loadConfig();
    const client = new EcoSafeSenseClient({
        baseUrl: config.baseUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
    });

    const device = await provisionDevice(config);
    console.log(
        `[backfill-sensors] provisioned device ${device.externalId} (id=${device.id}) org=${config.orgSlug} facility=${config.facilityId}`,
    );

    const knownDevices = await client.listDevices();
    console.log(`[backfill-sensors] vendor device list (GET /api/v1/sensors): ${JSON.stringify(knownDevices)}`);

    console.log('[backfill-sensors] running initial historical backfill...');
    await runCycle(client, device.id, config);

    console.log(
        `[backfill-sensors] starting ${POLL_INTERVAL_MS / 60_000}-minute poll loop (pid ${process.pid}) — ` +
            'run this under nohup for the demo window',
    );
    setInterval(() => {
        runCycle(client, device.id, config).catch((err: unknown) => {
            console.error('[backfill-sensors] cycle failed, will retry next interval:', err);
        });
    }, POLL_INTERVAL_MS);
}

// Guarded so importing runCycle/provisionDevice/loadConfig for tests doesn't
// also kick off main() (which would fail fast on missing env vars).
const isMainModule = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    // A hand-started process that dies on any uncaught rejection defeats the
    // entire point of the supervised-process requirement (step 6) — log and
    // keep polling instead.
    process.on('unhandledRejection', (err: unknown) => {
        console.error('[backfill-sensors] unhandled rejection (poller continues):', err);
    });

    main().catch((err: unknown) => {
        console.error('[backfill-sensors] fatal error during startup:', err);
        process.exit(1);
    });
}
