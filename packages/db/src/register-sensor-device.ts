import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { nameIsHardwareId, sensorDeviceIdProblem } from '@bin-tracker/types';
import { prisma } from './client.js';
import { assertSensorDeviceOrgConsistency } from './assert-sensor-device-org.js';

/**
 * Developer tool for registering a device from the command line. Platform
 * admins normally do this on the Sensor Fleet screens (which also handle pasted
 * lists, the unassigned inbox and reassignment); this exists for local setup,
 * scripts and emergencies.
 *
 * Without --org/--facility the device is created UNASSIGNED: the ingest endpoint
 * accepts its readings, but no tenant sees it until a platform admin assigns it.
 * With --org and --facility (and optionally --zone) it is created ACTIVE under
 * that tenant. Either way the push-ingest key identifies no tenant, so this
 * registration is what decides which org a device's data lands in.
 *
 * Run: pnpm --filter @bin-tracker/db register:sensor-device --device-id <id> \
 *        [--org <slug> --facility <facilityId> [--zone <slug>]] [--label "..."]
 */

export interface RegisterSensorDeviceArgs {
    /** The device's own id — what firmware sends as `p_device_id`. */
    externalId: string;
    orgSlug?: string;
    facilityId?: string;
    /** Slug of a zone of that facility (e.g. wetaging). */
    zoneSlug?: string;
    /** The tenant-facing name; defaults to the id. */
    label?: string;
    /** Recorded in the audit log. */
    actorId?: string;
}

/** The slice of the Prisma client this needs; narrow so tests can fake it. */
export type RegisterSensorDeviceDb = Pick<
    typeof prisma,
    'organization' | 'facility' | 'zone' | 'sensorDevice' | 'sensorDeviceAuditLog' | 'unknownSensorDeviceId' | '$transaction'
>;

export async function registerSensorDevice(db: RegisterSensorDeviceDb, args: RegisterSensorDeviceArgs) {
    const externalId = args.externalId.trim();
    const problem = sensorDeviceIdProblem(externalId);
    if (problem) throw new Error(`invalid device id: ${problem}`);

    const placed = Boolean(args.orgSlug && args.facilityId);
    if (!placed && (args.orgSlug || args.facilityId || args.zoneSlug)) {
        throw new Error('--org and --facility must be given together (and --zone needs both)');
    }

    // externalId is globally unique. Never silently move a device between
    // tenants — that would redirect its readings into another org.
    const existing = await db.sensorDevice.findUnique({ where: { externalId } });
    if (existing) throw new Error(`device ${externalId} is already registered`);

    // The label is the tenant-facing device name. For an UNASSIGNED device it can default to the id
    // (admins only see it until assignment), but an assigned device with that name would show the
    // hardware id to its tenant.
    if (placed && !args.label) throw new Error('--label is required when assigning: tenants see it as the device name');
    if (placed && nameIsHardwareId(args.label!, externalId)) {
        throw new Error('--label must not be the hardware id: tenants see it as the device name');
    }
    const label = args.label ?? externalId;
    const actorId = args.actorId ?? 'cli';

    let data: Parameters<typeof db.sensorDevice.create>[0]['data'] = { externalId, label };
    let assignment: { organizationId: string; facilityId: string; zoneId: string | null } | null = null;

    if (placed) {
        const org = await db.organization.findUnique({ where: { slug: args.orgSlug! } });
        if (!org) throw new Error(`organization not found: ${args.orgSlug}`);

        const facility = await db.facility.findFirst({ where: { id: args.facilityId!, deletedAt: null } });
        if (!facility) throw new Error(`facility not found (or deleted): ${args.facilityId}`);
        assertSensorDeviceOrgConsistency({ organizationId: org.id }, facility);

        // A typo'd zone would save a device no page ever shows, so resolve it now.
        const zone = args.zoneSlug
            ? await db.zone.findUnique({ where: { facilityId_slug: { facilityId: facility.id, slug: args.zoneSlug } } })
            : null;
        if (args.zoneSlug && !zone) throw new Error(`unknown zone "${args.zoneSlug}" for facility ${facility.id}`);

        assignment = { organizationId: org.id, facilityId: facility.id, zoneId: zone?.id ?? null };
        data = { externalId, label, state: 'ACTIVE', ...assignment, assignedAt: new Date() };
    }

    const device = await db.$transaction(async (tx) => {
        const created = await tx.sensorDevice.create({ data });
        await tx.sensorDeviceAuditLog.create({
            data: { deviceId: created.id, actorId, action: 'device.add', newValue: { externalId } },
        });
        if (assignment) {
            await tx.sensorDeviceAuditLog.create({
                data: { deviceId: created.id, actorId, action: 'device.assign', newValue: { ...assignment, name: label } },
            });
        }
        return created;
    });

    // It is registered now; stop listing it as an unknown id.
    await db.unknownSensorDeviceId.deleteMany({ where: { externalId } });
    return device;
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            'device-id': { type: 'string' },
            org: { type: 'string' },
            facility: { type: 'string' },
            zone: { type: 'string' },
            label: { type: 'string' },
        },
    });
    if (!values['device-id']) {
        throw new Error('usage: --device-id <id> [--org <slug> --facility <facilityId> [--zone <slug>]] [--label "..."]');
    }

    const device = await registerSensorDevice(prisma, {
        externalId: values['device-id'],
        orgSlug: values.org,
        facilityId: values.facility,
        zoneSlug: values.zone,
        label: values.label,
    });
    console.log(`registered ${device.externalId} (${device.state}) as "${device.label}"`);
    if (device.state === 'UNASSIGNED') console.log('  not visible to any tenant until assigned on the Sensor Fleet screen');
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
