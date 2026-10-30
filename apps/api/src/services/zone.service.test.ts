import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the zone/facility/sensorDevice calls zone.service.ts makes.

interface FakeZone {
  id: string;
  facilityId: string;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
}

const store = vi.hoisted(() => ({
  zones: [] as FakeZone[],
  facilities: [] as Array<{ id: string; name: string; deletedAt: Date | null }>,
  devices: [] as Array<{ id: string; zoneId: string | null }>,
  nextId: 0,
}));

vi.mock('@bin-tracker/db', () => {
  const facilityName = (id: string) => store.facilities.find((f) => f.id === id)?.name ?? '';
  const withFacility = (z: FakeZone) => ({ ...z, facility: { name: facilityName(z.facilityId) } });

  const zone = {
    findMany: ({ where }: { where: { facilityId: string | { in: string[] }; facility?: { deletedAt: null } } }) => {
      const ids = typeof where.facilityId === 'string' ? [where.facilityId] : where.facilityId.in;
      return Promise.resolve(
        store.zones
          .filter((z) => ids.includes(z.facilityId))
          .filter((z) => !where.facility || store.facilities.find((f) => f.id === z.facilityId)?.deletedAt === null)
          .sort((a, b) => facilityName(a.facilityId).localeCompare(facilityName(b.facilityId)) || a.sortOrder - b.sortOrder)
          .map(withFacility),
      );
    },
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(store.zones.find((z) => z.id === where.id) ?? null),
    create: ({ data }: { data: Omit<FakeZone, 'id'> }) => {
      store.nextId += 1;
      const created = { id: `zone-${store.nextId}`, ...data };
      store.zones.push(created);
      return Promise.resolve(withFacility(created));
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<FakeZone> }) => {
      const z = store.zones.find((x) => x.id === where.id)!;
      Object.assign(z, data);
      return Promise.resolve(withFacility(z));
    },
    delete: ({ where }: { where: { id: string } }) => {
      store.zones = store.zones.filter((z) => z.id !== where.id);
      return Promise.resolve({});
    },
  };
  const facility = {
    findFirst: ({ where }: { where: { id: string; deletedAt: null } }) =>
      Promise.resolve(store.facilities.find((f) => f.id === where.id && f.deletedAt === null) ?? null),
  };
  const sensorDevice = {
    count: ({ where }: { where: { zoneId: string } }) =>
      Promise.resolve(store.devices.filter((d) => d.zoneId === where.zoneId).length),
  };

  return { prisma: { zone, facility, sensorDevice, $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops) } };
});

const { zoneService, slugifyZoneName } = await import('./zone.service.js');

const zone = (id: string, facilityId: string, slug: string, sortOrder: number): FakeZone => ({
  id,
  facilityId,
  slug,
  name: slug,
  icon: 'grid',
  sortOrder,
});

beforeEach(() => {
  store.facilities = [
    { id: 'fac-a', name: 'Alpha Plant', deletedAt: null },
    { id: 'fac-b', name: 'Beta Plant', deletedAt: null },
    { id: 'fac-gone', name: 'Gone Plant', deletedAt: new Date() },
  ];
  store.zones = [
    zone('za1', 'fac-a', 'receiving', 0),
    zone('za2', 'fac-a', 'wetaging', 1),
    zone('zb1', 'fac-b', 'receiving', 0),
    zone('zg1', 'fac-gone', 'receiving', 0),
  ];
  store.devices = [];
  store.nextId = 0;
});

describe('slugifyZoneName', () => {
  it('lowercases and strips everything but letters and digits', () => {
    expect(slugifyZoneName('Wet Aging', new Set())).toBe('wetaging');
  });

  it('appends -2, -3… until the slug is free ("Wet-Aging" vs an existing wetaging)', () => {
    expect(slugifyZoneName('Wet-Aging', new Set(['wetaging']))).toBe('wetaging-2');
    expect(slugifyZoneName('Wet-Aging', new Set(['wetaging', 'wetaging-2']))).toBe('wetaging-3');
  });

  it('falls back to "zone" when nothing usable remains', () => {
    expect(slugifyZoneName('!!!', new Set())).toBe('zone');
  });
});

describe('zoneService reads', () => {
  it('listForFacilities returns only the given facilities, ordered by facility name then sortOrder, skipping deleted facilities', async () => {
    const result = await zoneService.listForFacilities(['fac-b', 'fac-a', 'fac-gone']);
    expect(result.map((z) => z.id)).toEqual(['za1', 'za2', 'zb1']);
    expect(result[0]).toMatchObject({ slug: 'receiving', facilityId: 'fac-a', facilityName: 'Alpha Plant' });
  });
});

describe('zoneService tenant response', () => {
  it('exposes no hardware or debug fields (guard against future drift)', async () => {
    const result = await zoneService.listForFacilities(['fac-a', 'fac-b']);
    const keys = new Set(result.flatMap((z) => Object.keys(z)));
    for (const forbidden of ['rawPayload', 'rssi', 'snr', 'filteredRssi', 'errorCode', 'errorMessage', 'externalId']) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect([...keys].sort()).toEqual(['facilityId', 'facilityName', 'icon', 'id', 'name', 'slug', 'sortOrder']);
  });
});

describe('zoneService.create', () => {
  it('appends after the last zone and returns a unique slug', async () => {
    const created = await zoneService.create({ facilityId: 'fac-a', name: 'Wet-Aging', icon: 'snow' });
    expect(created).toMatchObject({ slug: 'wetaging-2', name: 'Wet-Aging', sortOrder: 2, icon: 'snow', facilityId: 'fac-a' });
  });

  it('starts at sortOrder 0 in a facility with no zones', async () => {
    store.zones = [];
    const created = await zoneService.create({ facilityId: 'fac-a', name: 'Cold Room', icon: 'grid' });
    expect(created.sortOrder).toBe(0);
  });

  it('rejects a deleted or unknown facility with NOT_FOUND', async () => {
    await expect(zoneService.create({ facilityId: 'fac-gone', name: 'X', icon: 'grid' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('zoneService.rename', () => {
  it('changes the name but keeps the slug so existing links keep working', async () => {
    const renamed = await zoneService.rename('za2', 'Dry Aging');
    expect(renamed).toMatchObject({ name: 'Dry Aging', slug: 'wetaging' });
  });

  it('rejects an unknown zone with NOT_FOUND', async () => {
    await expect(zoneService.rename('nope', 'X')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('zoneService.reorder', () => {
  it('writes sortOrder from the new order', async () => {
    await zoneService.reorder('fac-a', ['za2', 'za1']);
    expect(store.zones.find((z) => z.id === 'za2')!.sortOrder).toBe(0);
    expect(store.zones.find((z) => z.id === 'za1')!.sortOrder).toBe(1);
  });

  it('rejects a missing or foreign zone id and changes nothing', async () => {
    const before = JSON.stringify(store.zones);
    await expect(zoneService.reorder('fac-a', ['za1'])).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(zoneService.reorder('fac-a', ['za1', 'zb1'])).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(zoneService.reorder('fac-a', ['za1', 'za1'])).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(JSON.stringify(store.zones)).toBe(before);
  });
});

describe('zoneService.remove', () => {
  it('deletes an unused zone', async () => {
    await zoneService.remove('za1');
    expect(store.zones.some((z) => z.id === 'za1')).toBe(false);
  });

  it('refuses a zone with an assigned device and leaves it in place', async () => {
    store.devices = [{ id: 'dev-1', zoneId: 'za2' }];
    await expect(zoneService.remove('za2')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(store.zones.some((z) => z.id === 'za2')).toBe(true);
  });

  it('rejects an unknown zone with NOT_FOUND', async () => {
    await expect(zoneService.remove('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
