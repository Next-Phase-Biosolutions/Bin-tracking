import { describe, expect, it, vi } from 'vitest';
import { registerSensorDevice, type RegisterSensorDeviceDb } from './register-sensor-device.js';

interface Overrides {
    org: unknown;
    facility: unknown;
    existing: unknown;
    zone: unknown;
}

function fakeDb(overrides: Partial<Overrides> = {}) {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data }));
    const auditCreate = vi.fn().mockResolvedValue({});
    const forget = vi.fn().mockResolvedValue({ count: 0 });
    const db = {
        organization: {
            findUnique: vi.fn().mockResolvedValue('org' in overrides ? overrides.org : { id: 'org-a', slug: 'meatech' }),
        },
        facility: {
            findFirst: vi
                .fn()
                .mockResolvedValue('facility' in overrides ? overrides.facility : { id: 'fac-1', organizationId: 'org-a' }),
        },
        zone: {
            findUnique: vi.fn().mockResolvedValue('zone' in overrides ? overrides.zone : { id: 'zone-wa', facilityId: 'fac-1' }),
        },
        sensorDevice: {
            findUnique: vi.fn().mockResolvedValue('existing' in overrides ? overrides.existing : null),
            create,
        },
        sensorDeviceAuditLog: { create: auditCreate },
        unknownSensorDeviceId: { deleteMany: forget },
        $transaction: (cb: (tx: unknown) => unknown) => cb(db),
    } as unknown as RegisterSensorDeviceDb;
    return { db, create, auditCreate, forget };
}

const DEVICE_ID = 'MT-0001';
const placed = { externalId: DEVICE_ID, orgSlug: 'meatech', facilityId: 'fac-1', label: 'Wet aging cooler' };

describe('registerSensorDevice — id rules', () => {
    it('accepts a sequential vendor id (no length floor)', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { externalId: 'master-01' });
        expect(create).toHaveBeenCalledOnce();
    });

    it('trims the id', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { externalId: '  MT-0001  ' });
        expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalId: 'MT-0001' }) });
    });

    it('rejects a blank id', async () => {
        const { db, create } = fakeDb();
        await expect(registerSensorDevice(db, { externalId: '   ' })).rejects.toThrow(/empty/);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects ids that are unsafe in headers, URLs or logs', async () => {
        const { db } = fakeDb();
        for (const bad of ['a b', 'a/b', 'café-01', 'a\nb', 'x'.repeat(65)]) {
            await expect(registerSensorDevice(db, { externalId: bad })).rejects.toThrow();
        }
    });

    it('refuses to re-register an existing id — that would move a device between tenants', async () => {
        const { db, create } = fakeDb({ existing: { id: 'x', organizationId: 'org-b' } });
        await expect(registerSensorDevice(db, { externalId: DEVICE_ID })).rejects.toThrow(/already registered/i);
        expect(create).not.toHaveBeenCalled();
    });
});

describe('registerSensorDevice — unassigned', () => {
    it('creates an UNASSIGNED device named after its id when no org/facility is given', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { externalId: DEVICE_ID });
        expect(create).toHaveBeenCalledWith({ data: { externalId: DEVICE_ID, label: DEVICE_ID } });
    });

    it('uses --label as the name when given', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { externalId: DEVICE_ID, label: 'Spare' });
        expect(create).toHaveBeenCalledWith({ data: { externalId: DEVICE_ID, label: 'Spare' } });
    });

    it('writes one device.add audit row with actor "cli" and forgets the id from the unknown log', async () => {
        const { db, auditCreate, forget } = fakeDb();
        await registerSensorDevice(db, { externalId: DEVICE_ID });
        expect(auditCreate).toHaveBeenCalledTimes(1);
        expect(auditCreate).toHaveBeenCalledWith({
            data: { deviceId: 'new-id', actorId: 'cli', action: 'device.add', newValue: { externalId: DEVICE_ID } },
        });
        expect(forget).toHaveBeenCalledWith({ where: { externalId: DEVICE_ID } });
    });

    it('records a custom actor', async () => {
        const { db, auditCreate } = fakeDb();
        await registerSensorDevice(db, { externalId: DEVICE_ID, actorId: 'dev-1' });
        expect(auditCreate.mock.calls[0]![0].data.actorId).toBe('dev-1');
    });

    it('requires org and facility together', async () => {
        const { db, create } = fakeDb();
        await expect(registerSensorDevice(db, { externalId: DEVICE_ID, orgSlug: 'meatech' })).rejects.toThrow(/together/);
        await expect(registerSensorDevice(db, { externalId: DEVICE_ID, facilityId: 'fac-1' })).rejects.toThrow(/together/);
        await expect(registerSensorDevice(db, { externalId: DEVICE_ID, zoneSlug: 'wetaging' })).rejects.toThrow(/together/);
        expect(create).not.toHaveBeenCalled();
    });
});

describe('registerSensorDevice — the tenant sees the label as the device name', () => {
    it('refuses to assign without a label, since the default would be the hardware id', async () => {
        const { db, create } = fakeDb();
        await expect(
            registerSensorDevice(db, { externalId: DEVICE_ID, orgSlug: 'meatech', facilityId: 'fac-1' }),
        ).rejects.toThrow(/--label/);
        expect(create).not.toHaveBeenCalled();
    });

    it('refuses a label that is just the hardware id', async () => {
        const { db, create } = fakeDb();
        await expect(registerSensorDevice(db, { ...placed, label: 'mt-0001' })).rejects.toThrow(/hardware id/i);
        expect(create).not.toHaveBeenCalled();
    });

    it('still defaults the label to the id for an UNASSIGNED device (admin-only until it is assigned)', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { externalId: DEVICE_ID });
        expect(create).toHaveBeenCalledWith({ data: { externalId: DEVICE_ID, label: DEVICE_ID } });
    });
});

describe('registerSensorDevice — assigned', () => {
    it("creates an ACTIVE device under the facility's org with assignedAt set", async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, placed);
        expect(create).toHaveBeenCalledWith({
            data: {
                externalId: DEVICE_ID,
                label: 'Wet aging cooler',
                state: 'ACTIVE',
                organizationId: 'org-a',
                facilityId: 'fac-1',
                zoneId: null,
                assignedAt: expect.any(Date),
            },
        });
    });

    it('resolves the zone slug inside the facility and stores its id', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { ...placed, zoneSlug: 'wetaging' });
        expect(db.zone.findUnique).toHaveBeenCalledWith({
            where: { facilityId_slug: { facilityId: 'fac-1', slug: 'wetaging' } },
        });
        expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ zoneId: 'zone-wa' }) });
    });

    it('rejects a zone slug the facility does not have, creating nothing', async () => {
        const { db, create, auditCreate } = fakeDb({ zone: null });
        await expect(registerSensorDevice(db, { ...placed, zoneSlug: 'wet-aging' })).rejects.toThrow(/unknown zone/i);
        expect(create).not.toHaveBeenCalled();
        expect(auditCreate).not.toHaveBeenCalled();
    });

    it('writes device.add then device.assign audit rows', async () => {
        const { db, auditCreate } = fakeDb();
        await registerSensorDevice(db, placed);
        expect(auditCreate.mock.calls.map(([arg]) => arg.data.action)).toEqual(['device.add', 'device.assign']);
        expect(auditCreate.mock.calls.every(([arg]) => arg.data.actorId === 'cli')).toBe(true);
    });

    it('rejects an unknown org slug', async () => {
        const { db, create } = fakeDb({ org: null });
        await expect(registerSensorDevice(db, placed)).rejects.toThrow(/organization/i);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects a facility that does not exist (or is soft-deleted)', async () => {
        const { db, create } = fakeDb({ facility: null });
        await expect(registerSensorDevice(db, placed)).rejects.toThrow(/facility/i);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects a facility that belongs to a different org', async () => {
        const { db, create } = fakeDb({ facility: { id: 'fac-1', organizationId: 'org-OTHER' } });
        await expect(registerSensorDevice(db, placed)).rejects.toThrow(/does not match/);
        expect(create).not.toHaveBeenCalled();
    });
});
