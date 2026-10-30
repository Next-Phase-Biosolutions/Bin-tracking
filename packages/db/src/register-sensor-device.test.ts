import { describe, expect, it, vi } from 'vitest';
import {
    generateDeviceId,
    MIN_DEVICE_ID_LENGTH,
    registerSensorDevice,
    type RegisterSensorDeviceDb,
} from './register-sensor-device.js';

function fakeDb(overrides: Partial<{ org: unknown; facility: unknown; existing: unknown; zone: unknown }> = {}) {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data }));
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
    } as unknown as RegisterSensorDeviceDb;
    return { db, create };
}

const DEVICE_ID = 'wa-7f3a9c2e1b4d6a08';
const args = { orgSlug: 'meatech', facilityId: 'fac-1', externalId: DEVICE_ID, label: 'Wet aging cooler' };

describe('registerSensorDevice', () => {
    it('creates the device under the facility\'s org', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, args);
        expect(create).toHaveBeenCalledWith({
            data: {
                externalId: DEVICE_ID,
                organizationId: 'org-a',
                facilityId: 'fac-1',
                label: 'Wet aging cooler',
                zoneId: null,
                state: 'ACTIVE',
                assignedAt: expect.any(Date),
            },
        });
    });

    it('rejects an unknown org slug', async () => {
        const { db, create } = fakeDb({ org: null });
        await expect(registerSensorDevice(db, args)).rejects.toThrow(/organization/i);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects a facility that does not exist (or is soft-deleted)', async () => {
        const { db, create } = fakeDb({ facility: null });
        await expect(registerSensorDevice(db, args)).rejects.toThrow(/facility/i);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects a facility that belongs to a different org', async () => {
        const { db, create } = fakeDb({ facility: { id: 'fac-1', organizationId: 'org-OTHER' } });
        await expect(registerSensorDevice(db, args)).rejects.toThrow(/does not match/);
        expect(create).not.toHaveBeenCalled();
    });

    it('refuses to re-register a device id that already belongs to a tenant', async () => {
        const { db, create } = fakeDb({ existing: { id: 'x', organizationId: 'org-b' } });
        await expect(registerSensorDevice(db, args)).rejects.toThrow(/already registered/i);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects a blank device id', async () => {
        const { db } = fakeDb();
        await expect(registerSensorDevice(db, { ...args, externalId: '  ' })).rejects.toThrow(/device id/i);
    });

    // The shared ingest key identifies no tenant, so the device id is the second
    // secret protecting one org's devices from another key-holder. Guessable ids
    // (master-01) defeat that.
    it('rejects a device id shorter than the minimum', async () => {
        const { db, create } = fakeDb();
        await expect(registerSensorDevice(db, { ...args, externalId: 'master-01' })).rejects.toThrow(
            new RegExp(`at least ${MIN_DEVICE_ID_LENGTH}`),
        );
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects device ids with characters that are unsafe in headers, URLs or logs', async () => {
        const { db } = fakeDb();
        for (const bad of ['wa 7f3a9c2e1b4d6a08', 'wa/7f3a9c2e1b4d6a08', 'wa-7f3a9c2e1b4d6a0\u00e9', 'wa-7f3a9c2e\n1b4d6a08']) {
            await expect(registerSensorDevice(db, { ...args, externalId: bad })).rejects.toThrow(/may only contain/);
        }
    });
});

describe('generateDeviceId', () => {
    it('produces an id the registration rules accept', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { ...args, externalId: generateDeviceId() });
        expect(create).toHaveBeenCalledOnce();
    });

    it('carries at least 128 bits of randomness and never repeats', () => {
        const ids = new Set(Array.from({ length: 50 }, generateDeviceId));
        expect(ids.size).toBe(50);
        const hex = [...ids][0]!.replace(/^[a-z]+-/, '');
        expect(hex).toMatch(/^[0-9a-f]{32}$/);
    });
});

describe('registerSensorDevice — zone', () => {
    it('resolves the zone slug inside the facility and stores its id', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, { ...args, zone: 'wetaging' });
        expect(db.zone.findUnique).toHaveBeenCalledWith({
            where: { facilityId_slug: { facilityId: 'fac-1', slug: 'wetaging' } },
        });
        expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ zoneId: 'zone-wa' }) });
    });

    it('leaves the zone null when omitted', async () => {
        const { db, create } = fakeDb();
        await registerSensorDevice(db, args);
        expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ zoneId: null }) });
    });

    it('rejects a zone slug the facility does not have instead of creating a device no page shows', async () => {
        const { db, create } = fakeDb({ zone: null });
        await expect(registerSensorDevice(db, { ...args, zone: 'wet-aging' })).rejects.toThrow(/unknown zone/i);
        expect(create).not.toHaveBeenCalled();
    });
});
