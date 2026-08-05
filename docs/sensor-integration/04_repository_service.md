# Action Item 4 — Sensor Service

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-repository-service   ← this branch (single service file, no repository layer — see below)
```
Branch from `feature/sensor-integration`, after Action Item 1 (schema) is merged.

## What This Is
The org-scoped data access and business logic layer: ownership checks, read-time threshold computation. This is the layer the router (Action Item 5) and the backfill script (Action Item 3) both call.

## What To Do
**No separate repository layer.** There is no other `*.repository.ts` in this codebase — every service (e.g. `shipment.service.ts`) imports `prisma` from `@bin-tracker/db` directly and queries inline; services are also flat files, not nested folders. Three queries don't justify a new architectural layer and a new directory convention. Create one file: `apps/api/src/services/sensor.service.ts` (flat, matching `shipment.service.ts`'s location pattern — not `services/sensor/sensor.service.ts`).

1. Create `packages/types/src/sensor-thresholds.ts`:
```typescript
export const SENSOR_THRESHOLDS = {
  temp:     { warnLow: 2,  warnHigh: 8,  alertLow: 0,  alertHigh: 12 },
  humidity: { warnLow: 30, warnHigh: 70, alertLow: 20, alertHigh: 85 },
  nh3:      { warnPpm: 25, alertPpm: 50 },
} as const; // PLACEHOLDER — confirm real values with vendor

export function computeThresholdStatus(reading: {
  tempC: number; humidityPct: number; nh3Ppm: number | null;
  tvoc?: number | null; eco2Ppm?: number | null; aqhiPlus?: number | null;
  ozonePpb?: number | null; pressure?: number | null; pm25?: number | null;
}): {
  overall: 'OK' | 'WARN' | 'ALERT';
  byMetric: { temp: 'OK' | 'WARN' | 'ALERT'; humidity: 'OK' | 'WARN' | 'ALERT'; nh3: 'OK' | 'WARN' | 'ALERT' };
} {
  // compute each of temp/humidity/nh3 independently against SENSOR_THRESHOLDS,
  // then overall = the worst of the three (ALERT > WARN > OK).
  // The six air-quality metrics have no thresholds yet and are not part of this
  // computation — they're captured and displayed (Action Item 8) but not alert-gated.
}
```
**Must be re-exported from `packages/types/src/index.ts`** — without this, nothing outside the package can import it, and the build breaks at the first usage site.

2. Create `apps/api/src/services/sensor.service.ts`:
```typescript
import { prisma } from '@bin-tracker/db';
import { TRPCError } from '@trpc/server';
import { computeThresholdStatus } from '@bin-tracker/types';

const READINGS_TAKE_LIMIT = 2000; // hard cap — see note below

export const sensorService = {
  async listDevicesForOrg(organizationId: string, facilityIds: string[]) {
    const [devices, org] = await Promise.all([
      prisma.sensorDevice.findMany({
        where: { organizationId, facilityId: { in: facilityIds } },
        include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } },
      }),
      prisma.settings.findUnique({ where: { organizationId }, select: { companyTimezone: true } }),
    ]);
    return {
      companyTimezone: org?.companyTimezone ?? 'America/Toronto',
      devices: devices.map(d => ({
        ...d,
        latestStatus: d.readings[0]
          ? computeThresholdStatus({
              tempC: d.readings[0].tempC,
              humidityPct: d.readings[0].humidityPct,
              nh3Ppm: d.readings[0].nh3Ppm,
              tvoc: d.readings[0].tvoc,
              eco2Ppm: d.readings[0].eco2Ppm,
              aqhiPlus: d.readings[0].aqhiPlus,
              ozonePpb: d.readings[0].ozonePpb,
              pressure: d.readings[0].pressure,
              pm25: d.readings[0].pm25,
            })
          : { overall: 'UNKNOWN' as const, byMetric: { temp: 'UNKNOWN' as const, humidity: 'UNKNOWN' as const, nh3: 'UNKNOWN' as const } },
      })),
    };
  },

  async getDeviceHistory(organizationId: string, deviceId: string, range: '24h' | '7d') {
    const device = await prisma.sensorDevice.findFirst({ where: { id: deviceId, organizationId } });
    if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

    const since = range === '24h'
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Cap at the NEWEST rows, not the oldest — orderBy desc + take + reverse.
    // orderBy asc + take would silently return the start of the window and
    // drop everything recent, which is backwards for a live-monitoring chart.
    const rows = await prisma.sensorReading.findMany({
      where: { deviceId, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: READINGS_TAKE_LIMIT,
    });
    return rows.reverse();
  },
};
```
**Two things fixed from the earlier draft:**
- **`take` limit added.** `getReadings` had no bound — a `7d` range at the observed reading density (up to 7 rows per 5-min window in bursts) is unbounded and could hang the chart on a chatty device. `2000` is a starting cap; tune once real deployed-device density is known.
- **Ownership check inlined, not a separate `getDeviceIfOwned` step exposed elsewhere.** `getDeviceHistory` is the only place that needs it, and it throws `NOT_FOUND` before any reading is touched — this is the critical line in the whole feature; do not let it drift into a separately-callable function that a future caller might skip.

**Where the "never average" instruction actually belongs:** at this layer, each row is evaluated independently — there's nothing to average here. The averaging risk lives entirely in the chart/aggregation layer (Action Item 8), not here. Don't add clustering/averaging logic to this file; it doesn't belong.

**Sanity-check the placeholder thresholds against real backfilled data, in this branch (not Action Item 3 — that item runs in parallel and must not depend on this file).** Once Action Item 3 has populated `SensorReading`, run `computeThresholdStatus` across the dataset and look at the OK/WARN/ALERT distribution it produces. Two concrete risks with the current placeholders: `nh3.warnPpm: 25` against observed readings of 0.07–0.10 ppm means ammonia can never leave `OK` (off by roughly 250×); `temp.alertHigh: 12°C` means every reading is a permanent `ALERT` if the device isn't actually in cold storage during the demo. Either produces a dashboard that's one solid color throughout — decorative, not informative. Adjust the placeholder numbers so the demo data plausibly spans OK/WARN/ALERT; this is a ten-minute check, not a design change, but do it after Item 3 has real data to check against.

**Per-metric badges need per-metric data — the return shape above already accounts for this.** Action Item 8 wants a status badge on each of the 3 core metric charts individually, not just one aggregate value for the whole reading — that's why `computeThresholdStatus` returns `{ overall, byMetric }` rather than a single status. Update `latestStatus` in `listDevicesForOrg` to carry this full shape through — Action Item 8's per-chart badges read `byMetric.temp` / `.humidity` / `.nh3`; the device-level badge (Action Item 8's `DeviceCard`) reads `.overall`.

**Response shape note:** `listDevicesForOrg` now returns `{ companyTimezone, devices }`, not a bare array — this is what lets Action Item 8's frontend bucket the chart in the org's actual timezone without a separate, permission-gated `settings.get` call (see Action Item 8 for why that call doesn't work for non-admin roles). Anything consuming this response (the router, the frontend) must destructure it accordingly, not treat the result as a devices array directly.

## Acceptance Criteria
- [ ] Single file, `apps/api/src/services/sensor.service.ts` — no repository layer, no nested `services/sensor/` folder
- [ ] `sensor-thresholds.ts` is re-exported from `packages/types/src/index.ts`
- [ ] `getDeviceHistory` throws `NOT_FOUND` when `deviceId` belongs to a different `organizationId` — verified before any reading is returned
- [ ] `getReadings`-equivalent query has a `take` limit
- [ ] No averaging or clustering logic present at this layer

## Test Cases To Add
1. **Cross-tenant isolation test** (add to `tenancy-isolation.test.ts`): Org A creates a device; Org B calls `getDeviceHistory` with Org A's `deviceId`; assert `NOT_FOUND`, not data.
2. **Threshold boundary tests**: values just inside/outside each warn/alert boundary for temp, humidity, and nh3.
3. **Take-limit test**: seed more than `READINGS_TAKE_LIMIT` rows for one device/range and confirm the result is capped, AND that the retained rows are the most recent ones (not the oldest) — the `orderBy desc + take + reverse` pattern, not `orderBy asc + take`.

## How To Test
```bash
pnpm --filter @bin-tracker/api test sensor
```
Run the isolation test case manually to confirm the `NOT_FOUND` behavior before merging.
