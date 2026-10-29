import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the sensorDevice/sensorReading calls sensor-ingest.service.ts makes.

interface FakeDevice {
  id: string;
  organizationId: string;
  externalId: string;
  status: string;
  lastSeenAt: Date | null;
}

interface FakeReading {
  deviceId: string;
  timestamp: Date;
  [key: string]: unknown;
}

const store = vi.hoisted(() => ({
  devices: [] as FakeDevice[],
  readings: [] as FakeReading[],
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
    $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
  },
}));

const { sensorIngestService, UnknownSensorDeviceError } = await import('./sensor-ingest.service.js');

const NOW = new Date('2026-10-29T12:00:00.000Z');

beforeEach(() => {
  store.devices = [
    { id: 'dev-a', organizationId: 'org-a', externalId: 'master-01', status: 'ACTIVE', lastSeenAt: null },
    { id: 'dev-b', organizationId: 'org-b', externalId: 'master-02', status: 'ACTIVE', lastSeenAt: null },
    { id: 'dev-off', organizationId: 'org-a', externalId: 'retired-01', status: 'RETIRED', lastSeenAt: null },
  ];
  store.readings = [];
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

  it('rejects a registered but non-ACTIVE device', async () => {
    await expect(sensorIngestService.ingest({ p_device_id: 'retired-01', p_raw: {} }, NOW)).rejects.toBeInstanceOf(
      UnknownSensorDeviceError,
    );
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
