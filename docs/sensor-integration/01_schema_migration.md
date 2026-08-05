# Action Item 1 — Sensor Schema Migration

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-schema-migration   ← this branch
```
Branch from `feature/sensor-integration`. Merge back into `feature/sensor-integration` when done.

**Base branch: `main`.** `feature/sensor-integration` is cut directly from `main` — no `dev` branch in this workflow.

## What This Is
The foundational data model for the sensor feature — two new Prisma tables (`SensorDevice`, `SensorReading`) plus a `ModuleKey` value, which is handled in Action Item 2, not here. This item is schema only.

**Scope update:** in addition to temperature/humidity/ammonia, the vendor's device also reports TVOC, eCO2, AQHI+, ozone, pressure, and PM2.5 (confirmed via live `/lastReading` response — all six fields present, `avg_`-prefixed). These are now captured too, all nullable — not every endpoint/device will populate all of them, and `/download` support for each of these fields as a query param hasn't been individually verified yet (only `temperature_celsius`, `humidity`, `ammonia_ppm`, `aqhi_plus` confirmed working in `/download` so far).

## What To Do
1. Add to `packages/db/prisma/schema.prisma`:
```prisma
model SensorDevice {
  id             String    @id @default(cuid())
  organizationId String
  facilityId     String
  externalId     String    @unique
  label          String
  status         String    @default("ACTIVE")
  lastSeenAt     DateTime?
  createdAt      DateTime  @default(now())

  organization Organization    @relation(fields: [organizationId], references: [id])
  facility     Facility        @relation(fields: [facilityId], references: [id])
  readings     SensorReading[]

  @@index([organizationId])
  @@index([facilityId])
  @@map("sensor_devices")
}

model SensorReading {
  id          String   @id @default(cuid())
  deviceId    String
  timestamp   DateTime
  tempC       Float
  humidityPct Float
  nh3Ppm      Float?
  tvoc        Float?
  eco2Ppm     Float?
  aqhiPlus    Float?
  ozonePpb    Float?
  pressure    Float?
  pm25        Float?

  device SensorDevice @relation(fields: [deviceId], references: [id])

  @@index([deviceId, timestamp])
  @@map("sensor_readings")
}
```
**Change from earlier draft: `thresholdStatus` is no longer a stored column.** Thresholds are placeholders pending vendor confirmation (see Action Item 4). If status is stored at insert time, every backfilled row becomes permanently wrong the moment real thresholds arrive — and it would be computed twice (once at insert, once again at read in `listDevicesForOrg`), two sources of truth that silently diverge. Status is now computed at read time only, in the service layer, from `SENSOR_THRESHOLDS`.

2. Add relation lines to `Organization` and `Facility` models: `sensorDevices SensorDevice[]`.
3. **Unique-constraint decision — pick one explicitly, don't inherit a default.** Confirmed with the vendor's software lead on a call (Aug 5): the same-timestamp clusters with wildly different values (up to 7 rows at one timestamp, 6.5°C+ apart) came from the device's initial Wi-Fi setup/backlog period — the device was being handled and moved around while reconnecting, and this is explicitly **not** normal steady-state behavior for a mounted, undisturbed sensor. Separately, the device also has a confirmed-legitimate multi-row-per-cycle behavior: after any offline period, it uploads backlogged readings in batches (~10 per 5-minute upload cycle) until caught up — but those backlog rows have **distinct timestamps** from each other; they don't collide. Only the historical Wi-Fi-setup-period rows genuinely share a timestamp, and per the vendor that's garbage data from a one-time setup artifact, not an ongoing pattern.

   Given that, there are two real options — choose one, don't default into either:
   - **(a) Keep `id` (cuid) as the only unique key, with in-process de-duplication in Action Item 3.** More defensive, tolerates any future duplicate-timestamp scenario without insert failures, but carries a hand-maintained dedup mechanism (in-memory `Set`, tuple-equality assumption) as ongoing complexity.
   - **(b) Add `@@unique([deviceId, timestamp])` back, and let Action Item 3 use `createMany({ skipDuplicates: true })`.** Since legitimate backlog-catchup rows have distinct timestamps, this constraint doesn't block them — it only collapses the genuinely-garbage Wi-Fi-setup-period duplicates during backfill, which is arguably the correct behavior for data confirmed to be junk. This deletes Action Item 3's entire in-memory dedup mechanism (Set, tuple key, float-equality assumption) in exchange for one line (`skipDuplicates: true`).

   **Recommendation: (b).** It's simpler, and the only rows it would ever silently drop are ones the vendor has already told us aren't meaningful. If (a) is chosen instead for extra defensiveness, the dedup key in Action Item 3 must cover all 9 captured fields, not just the original 4 (`tempC`, `humidityPct`, `nh3Ppm`) — two rows identical in those three but differing in `tvoc`/`eco2Ppm`/etc. would otherwise be silently treated as duplicates and dropped.
4. **`lastSeenAt` must actually be used, not just declared.** It's the one field the demo genuinely needs — both real devices have been offline 13h+ during testing, and without this surfaced, a stale chart looks live. Action Item 3's poll must write it (update `SensorDevice.lastSeenAt` on every successful poll cycle, even if zero new rows), and Action Item 8's dashboard must display it ("last seen X ago").
5. **Assert `facility.organizationId === device.organizationId`** wherever a `SensorDevice` is created or mapped to a facility — nothing in the schema itself enforces this relationship is consistent. The only place a `SensorDevice` is actually created is Action Item 3's script — that's where this check must be implemented, not here; this item states the requirement, Action Item 3 owns the implementation.
6. Add explicit RLS migration SQL alongside the generated migration:
```sql
ALTER TABLE sensor_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
```
This repo's blanket RLS migration only covered tables that existed when it ran — new tables do not inherit it automatically. **Do not use `FORCE ROW LEVEL SECURITY`** — the existing RLS migration in this repo explains that `FORCE` strips the owner exemption and breaks the app; `ENABLE` only.
7. **Migration mechanics — decide and document one:** either hand-edit the Prisma-generated SQL file to add the two `ALTER TABLE` statements, or ship them as a second, separate migration immediately after. State which one was done in the PR description.
8. Run: `pnpm --filter @bin-tracker/db migrate:dev --name add_sensor_tables`

## Acceptance Criteria
- [ ] `SensorDevice` and `SensorReading` tables exist with the fields above — **no `thresholdStatus` column**
- [ ] Unique-constraint decision (Option a or b, step 3) is made explicitly and documented in the PR, not defaulted silently — if (b), `@@unique([deviceId, timestamp])` is present and Action Item 3 uses `skipDuplicates`; if (a), it's absent and Action Item 3's dedup key covers all 9 fields
- [ ] Both new tables have RLS explicitly enabled via `ENABLE` (not `FORCE`) — verify in migration SQL, not just Prisma schema
- [ ] `organizationId` and `facilityId` are direct columns on `SensorDevice` (not reached only via a join)
- [ ] `facility.organizationId === device.organizationId` is asserted at creation/mapping time
- [ ] Migration applies cleanly on a fresh local DB
- [ ] Existing tables/migrations are untouched — `git diff` shows only additive changes

## Test Cases To Add
1. **Migration smoke test** — migration runs without error against a clean DB, and against a DB with existing seed data (no destructive side effects on other tables).
2. **RLS verification test** — query `sensor_devices` / `sensor_readings` via the anon/PostgREST role (not the service role) and confirm access is denied by default, same pattern used to verify RLS on other tables in this repo.
3. **Insert-collision test** — insert two `SensorReading` rows with the same `deviceId` and `timestamp` but different `tempC`/`humidityPct` values; confirm both persist (no unique-constraint rejection).
4. **Mismatched-org assertion test** — attempt to create a `SensorDevice` whose `organizationId` doesn't match its `facilityId`'s owning org; confirm this is rejected, not silently allowed.

## How To Test
```bash
pnpm --filter @bin-tracker/db migrate:dev --name add_sensor_tables
pnpm --filter @bin-tracker/db exec prisma studio   # visually confirm tables exist
```
For the RLS check, connect with the anon key (not service role) via `psql` or Supabase client and attempt a `SELECT` on `sensor_readings` — it should return zero rows / permission denied, not the full table.

## Still Open (not resolved by this item)
Reading retention/volume policy, and what happens to historical readings if a device is reassigned between organizations, remain unresolved — the latter is a data-leak decision and must be made explicit before any device-reassignment flow is built, not defaulted.
