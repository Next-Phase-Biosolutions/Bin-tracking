import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the sensorDevice/sensorReading/unknownSensorDeviceId calls the ingest path makes
// (the real unknown-device-log service runs on top of this fake).

interface FakeDevice {
  id: string;
  organizationId: string | null;
  externalId: string;
  state: string;
  lastSeenAt: Date | null;
}

interface FakeReading {
  deviceId: string;
  timestamp: Date;
  [key: string]: unknown;
}

interface FakeUnknownRow {
  externalId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  count: number;
  lastTempC?: number | null;
  lastRawExcerpt?: string | null;
}

const store = vi.hoisted(() => ({
  devices: [] as FakeDevice[],
  readings: [] as FakeReading[],
  unknown: [] as FakeUnknownRow[],
}));

vi.mock('@bin-tracker/db', () => ({
  prisma: {
    sensorDevice: {
      findUnique: ({ where }: { where: { externalId: string } }) =>
        Promise.resolve(store.devices.find((d) => d.externalId === where.externalId) ?? null),
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; OR: Array<{ lastSeenAt: null } | { lastSeenAt: { lt: Date } }> };
        data: { lastSeenAt: Date };
      }) => {
        const d = store.devices.find((x) => x.id === where.id);
        if (d && (d.lastSeenAt === null || d.lastSeenAt < data.lastSeenAt)) d.lastSeenAt = data.lastSeenAt;
        return Promise.resolve({ count: d ? 1 : 0 });
      },
    },
    sensorReading: {
      createMany: ({ data, skipDuplicates }: { data: FakeReading[]; skipDuplicates: boolean }) => {
        let count = 0;
        for (const row of data) {
          const dupe = store.readings.some(
            (r) => r.deviceId === row.deviceId && r.timestamp.getTime() === row.timestamp.getTime(),
          );
          if (dupe && skipDuplicates) continue;
          store.readings.push(row);
          count += 1;
        }
        return Promise.resolve({ count });
      },
    },
    unknownSensorDeviceId: {
      deleteMany: () => Promise.resolve({ count: 0 }),
      findUnique: ({ where }: { where: { externalId: string } }) =>
        Promise.resolve(store.unknown.find((r) => r.externalId === where.externalId) ?? null),
      count: () => Promise.resolve(store.unknown.length),
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { externalId: string };
        update: Partial<FakeUnknownRow> & { count: { increment: number } };
        create: FakeUnknownRow;
      }) => {
        const existing = store.unknown.find((r) => r.externalId === where.externalId);
        if (existing) {
          const { count, ...rest } = update;
          Object.assign(existing, rest);
          existing.count += count.increment;
          return Promise.resolve(existing);
        }
        store.unknown.push({ ...create });
        return Promise.resolve(create);
      },
    },
    $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
  },
}));

const { sensorIngestService, UnknownSensorDeviceError } = await import('./sensor-ingest.service.js');

const NOW = new Date('2026-10-29T12:00:00.000Z');

beforeEach(() => {
  store.devices = [
    { id: 'dev-a', organizationId: 'org-a', externalId: 'master-01', state: 'ACTIVE', lastSeenAt: null },
    { id: 'dev-b', organizationId: 'org-b', externalId: 'master-02', state: 'ACTIVE', lastSeenAt: null },
    { id: 'dev-off', organizationId: 'org-a', externalId: 'retired-01', state: 'DEACTIVATED', lastSeenAt: null },
    { id: 'dev-new', organizationId: null, externalId: 'new-01', state: 'UNASSIGNED', lastSeenAt: null },
  ];
  store.readings = [];
  store.unknown = [];
});

describe('sensorIngestService.ingest', () => {
  it('stores the reading on the pre-registered device, mapping every field', async () => {
    await sensorIngestService.ingest(
      {
        p_device_id: 'master-01',
        p_raw: { battery_mv: 3712 },
        p_temp_c: 24.6,
        p_humidity_pct: 51.2,
        p_rssi: -67,
        p_snr: 9.5,
        p_filtered_rssi: -66,
        p_error_code: 0,
        p_error_message: null,
      },
      NOW,
    );

    expect(store.readings).toHaveLength(1);
    expect(store.readings[0]).toMatchObject({
      deviceId: 'dev-a',
      timestamp: NOW,
      tempC: 24.6,
      humidityPct: 51.2,
      rssi: -67,
      snr: 9.5,
      filteredRssi: -66,
      errorCode: 0,
      errorMessage: null,
      rawPayload: { battery_mv: 3712 },
    });
  });

  it('reads temperature and humidity from p_data', async () => {
    await sensorIngestService.ingest(
      { p_device_id: 'master-01', p_raw: {}, p_data: { temp_c: 3.4, humidity_pct: 62.1 } },
      NOW,
    );
    expect(store.readings[0]).toMatchObject({ tempC: 3.4, humidityPct: 62.1 });
    expect(store.readings[0]!.rawPayload).toEqual({});
  });

  it('prefers p_data over p_temp_c / p_humidity_pct, and falls back to them when p_data lacks a value', async () => {
    await sensorIngestService.ingest(
      { p_device_id: 'master-01', p_raw: {}, p_temp_c: 99, p_humidity_pct: 88, p_data: { temp_c: 3.4 } },
      NOW,
    );
    expect(store.readings[0]).toMatchObject({ tempC: 3.4, humidityPct: 88 });
  });

  it('keeps p_data keys it does not map in the stored raw payload instead of dropping them', async () => {
    await sensorIngestService.ingest(
      { p_device_id: 'master-01', p_raw: { fw: '1' }, p_data: { temp_c: 3.4, pm25: 12 } },
      NOW,
    );
    expect(store.readings[0]!.rawPayload).toEqual({ fw: '1', p_data_unmapped: { pm25: 12 } });
  });

  it('still stores the older flat fields exactly as before when p_data is absent', async () => {
    await sensorIngestService.ingest({ p_device_id: 'master-01', p_raw: {}, p_temp_c: 5, p_humidity_pct: 70 }, NOW);
    expect(store.readings[0]).toMatchObject({ tempC: 5, humidityPct: 70, rawPayload: {} });
  });

  it('logs the p_data temperature for an unknown id, like the flat field', async () => {
    await expect(
      sensorIngestService.ingest({ p_device_id: 'ghost-9', p_raw: {}, p_data: { temp_c: 21.5 } }, NOW),
    ).rejects.toBeInstanceOf(UnknownSensorDeviceError);
    expect(store.unknown[0]).toMatchObject({ lastTempC: 21.5 });
  });

  it('attributes the reading to the device owner and never to another org', async () => {
    await sensorIngestService.ingest({ p_device_id: 'master-02', p_raw: {} }, NOW);
    expect(store.readings.map((r) => r.deviceId)).toEqual(['dev-b']);
  });

  it('stores a fault-only reading with null temp and humidity', async () => {
    await sensorIngestService.ingest(
      { p_device_id: 'master-01', p_raw: {}, p_error_code: 100, p_error_message: 'sensor read timeout' },
      NOW,
    );
    expect(store.readings[0]).toMatchObject({ tempC: null, humidityPct: null, errorCode: 100 });
  });

  it('uses the device-supplied timestamp when present', async () => {
    await sensorIngestService.ingest(
      { p_device_id: 'master-01', p_raw: {}, p_timestamp: '2026-10-29T11:00:00Z' },
      NOW,
    );
    expect(store.readings[0]!.timestamp).toEqual(new Date('2026-10-29T11:00:00Z'));
  });

  it('rejects a device that was never registered', async () => {
    await expect(sensorIngestService.ingest({ p_device_id: 'ghost-99', p_raw: {} }, NOW)).rejects.toBeInstanceOf(
      UnknownSensorDeviceError,
    );
    expect(store.readings).toHaveLength(0);
  });

  it('stores readings from an UNASSIGNED device with organizationId null', async () => {
    await sensorIngestService.ingest({ p_device_id: 'new-01', p_raw: {}, p_temp_c: 4 }, NOW);
    expect(store.readings).toHaveLength(1);
    expect(store.readings[0]).toMatchObject({ deviceId: 'dev-new', organizationId: null, tempC: 4 });
  });

  it("stamps readings from an ACTIVE device with the device's organizationId", async () => {
    await sensorIngestService.ingest({ p_device_id: 'master-02', p_raw: {} }, NOW);
    expect(store.readings[0]).toMatchObject({ deviceId: 'dev-b', organizationId: 'org-b' });
  });

  it('rejects a DEACTIVATED device immediately and stores nothing', async () => {
    await expect(sensorIngestService.ingest({ p_device_id: 'retired-01', p_raw: {} }, NOW)).rejects.toBeInstanceOf(
      UnknownSensorDeviceError,
    );
    expect(store.readings).toHaveLength(0);
  });

  it('keeps a small sample of what an unknown id sent, for the admin to tell test devices apart', async () => {
    await expect(
      sensorIngestService.ingest({ p_device_id: 'ghost-9', p_temp_c: 21.5, p_raw: { fw: '1.2' } }, NOW),
    ).rejects.toBeInstanceOf(UnknownSensorDeviceError);
    expect(store.unknown[0]).toMatchObject({ externalId: 'ghost-9', lastTempC: 21.5, lastRawExcerpt: '{"fw":"1.2"}' });
  });

  it('does not log a deactivated id as unknown', async () => {
    await expect(sensorIngestService.ingest({ p_device_id: 'retired-01', p_raw: {} }, NOW)).rejects.toBeInstanceOf(
      UnknownSensorDeviceError,
    );
    expect(store.unknown).toHaveLength(0);
  });

  it('logs an unregistered id, then counts repeats', async () => {
    for (let i = 0; i < 2; i += 1) {
      await expect(sensorIngestService.ingest({ p_device_id: 'ghost-99', p_raw: {} }, NOW)).rejects.toBeInstanceOf(
        UnknownSensorDeviceError,
      );
    }
    expect(store.unknown).toMatchObject([{ externalId: 'ghost-99', firstSeenAt: NOW, lastSeenAt: NOW, count: 2 }]);
    expect(store.readings).toHaveLength(0);
  });

  it('collapses a retry with the same timestamp instead of duplicating', async () => {
    const body = { p_device_id: 'master-01', p_raw: {}, p_timestamp: '2026-10-29T11:00:00Z' };
    await sensorIngestService.ingest(body, NOW);
    await sensorIngestService.ingest(body, NOW);
    expect(store.readings).toHaveLength(1);
  });

  it('advances lastSeenAt to the newest reading and never moves it backwards', async () => {
    await sensorIngestService.ingest({ p_device_id: 'master-01', p_raw: {}, p_timestamp: '2026-10-29T11:00:00Z' }, NOW);
    expect(store.devices[0]!.lastSeenAt).toEqual(new Date('2026-10-29T11:00:00Z'));

    // A late-arriving older reading must not rewind "last seen".
    await sensorIngestService.ingest({ p_device_id: 'master-01', p_raw: {}, p_timestamp: '2026-10-29T09:00:00Z' }, NOW);
    expect(store.devices[0]!.lastSeenAt).toEqual(new Date('2026-10-29T11:00:00Z'));
  });
});
