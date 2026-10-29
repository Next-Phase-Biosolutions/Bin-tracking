import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { isSensorZoneId, SENSOR_ZONE_IDS } from '@bin-tracker/types';
import { prisma } from './client.js';
import { assertSensorDeviceOrgConsistency } from './assert-sensor-device-org.js';

/**
 * Registers a physical device to an org + facility so the push-ingest endpoint
 * (apps/api/src/routes/sensor-ingest.ts) will accept its readings. The ingest
 * key is shared by the whole fleet and says nothing about tenancy, so this
 * registration is the ONLY thing that decides which org a device's data lands in.
 *
 * The device id is the SECOND secret: any holder of the shared key can write to
 * any registered device whose id they can name, so ids must not be guessable
 * (`master-01` is not acceptable). Omit --device-id to have one generated, then
 * flash that exact value into the unit as `p_device_id`.
 *
 * Run: pnpm --filter @bin-tracker/db register:sensor-device \
 *        --org <slug> --facility <facilityId> [--device-id <device_id>] [--zone <zone>] [--label "..."]
 *
 * --zone picks which facility-zone page shows the device (e.g. wetaging).
 */

/**
 * Length floor for operator-supplied ids. Length can't prove entropy — a long
 * but predictable id (`meatech-cooler-0000001`) still passes — so prefer the
 * generated form.
 */
export const MIN_DEVICE_ID_LENGTH = 16;

// Safe to put in a JSON body, a log line or a URL without escaping.
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** `sensor-` + 128 random bits as hex. */
export function generateDeviceId(): string {
    return `sensor-${randomBytes(16).toString('hex')}`;
}

export interface RegisterSensorDeviceArgs {
    orgSlug: string;
    facilityId: string;
    /** The device's own id — what firmware sends as `p_device_id`. */
    externalId: string;
    label: string;
    /** Facility-zone page that shows this device (a SENSOR_ZONE_IDS value). */
    zone?: string;
}

/** The slice of the Prisma client this needs; narrow so tests can fake it. */
export type RegisterSensorDeviceDb = Pick<typeof prisma, 'organization' | 'facility' | 'sensorDevice'>;

export async function registerSensorDevice(db: RegisterSensorDeviceDb, args: RegisterSensorDeviceArgs) {
    const externalId = args.externalId.trim();
    if (!externalId) throw new Error('device id must not be empty');
    if (externalId.length < MIN_DEVICE_ID_LENGTH) {
        throw new Error(
            `device id must be at least ${MIN_DEVICE_ID_LENGTH} characters (it is a secret, not a label) — omit --device-id to generate one`,
        );
    }
    if (!DEVICE_ID_PATTERN.test(externalId)) {
        throw new Error('device id may only contain letters, digits, "-" and "_"');
    }

    if (args.zone !== undefined && !isSensorZoneId(args.zone)) {
        throw new Error(`unknown zone "${args.zone}" — expected one of: ${SENSOR_ZONE_IDS.join(', ')}`);
    }

    const org = await db.organization.findUnique({ where: { slug: args.orgSlug } });
    if (!org) throw new Error(`organization not found: ${args.orgSlug}`);

    const facility = await db.facility.findFirst({ where: { id: args.facilityId, deletedAt: null } });
    if (!facility) throw new Error(`facility not found (or deleted): ${args.facilityId}`);
    assertSensorDeviceOrgConsistency({ organizationId: org.id }, facility);

    // externalId is globally unique. Never silently move a device between
    // tenants — that would redirect its readings into another org.
    const existing = await db.sensorDevice.findUnique({ where: { externalId } });
    if (existing) {
        throw new Error(`device ${externalId} is already registered (org ${existing.organizationId})`);
    }

    return db.sensorDevice.create({
        data: { externalId, organizationId: org.id, facilityId: facility.id, label: args.label, zone: args.zone ?? null },
    });
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            org: { type: 'string' },
            facility: { type: 'string' },
            'device-id': { type: 'string' },
            label: { type: 'string' },
            zone: { type: 'string' },
        },
    });
    if (!values.org || !values.facility) {
        throw new Error('usage: --org <slug> --facility <facilityId> [--device-id <device_id>] [--zone <zone>] [--label "..."]');
    }

    const externalId = values['device-id'] ?? generateDeviceId();
    const device = await registerSensorDevice(prisma, {
        orgSlug: values.org,
        facilityId: values.facility,
        externalId,
        label: values.label ?? externalId,
        zone: values.zone,
    });
    console.log(`registered device org=${values.org} facility=${device.facilityId} zone=${device.zone ?? '(none)'}`);
    console.log(`  p_device_id (flash this into the unit): ${device.externalId}`);
}

// Guarded so importing registerSensorDevice for tests doesn't run main().
const isMainModule = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    main()
        .then(() => process.exit(0))
        .catch((err: unknown) => {
            console.error(err instanceof Error ? err.message : err);
            process.exit(1);
        });
}
