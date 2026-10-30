# Rollout

Order matters. The database migrations must run **before** the API is deployed: the new API reads columns that do not exist until they have.

## Before merging
- [ ] Development databases that applied an earlier version of `20261030090000_sensor_fleet_management` (the migration was edited before it ever shipped) must be reset (`pnpm --filter @bin-tracker/db exec prisma migrate reset`) or hand-patched; no production or staging database has it.
- [ ] Human review of PR #53 (an unauthenticated, key-gated endpoint plus platform-admin tooling).
- [ ] Run both new migrations against a prod-shaped database or staging and check the backfill (below).
- [ ] Open a zone page in a browser with a registered device and confirm the charts render.
- [ ] Post a real reading from firmware to the deployed endpoint (the step that needs the key).

## Deploy
1. **Back up** the production database (Supabase point-in-time recovery or a dump). There is no automatic down-migration, so rollback means restoring the backup.
2. **Run the migrations** on production: `pnpm db:migrate` (`prisma migrate deploy`). Three apply (none of them is on `main` yet):
   - `20261029120000_sensor_push_ingest_columns` — nullable `tempC` / `humidityPct`, and the radio / fault / raw-payload columns. Relaxes a constraint and adds columns only.
   - `20261029130000_sensor_device_zone` — adds the `zone` text column on `sensor_devices` (the fleet migration below reads it to find each device's zone row; the column itself stays for one release).
   - `20261030090000_sensor_fleet_management` — device states and `assignedAt`, per-facility `zones` (the six defaults seeded for every existing facility), `zoneId`, reading `organizationId` (backfilled from each device), the unknown-id log, audit log and platform settings tables, and a CHECK that an ACTIVE device is assigned. **Every device that already exists becomes DEACTIVATED** (they are legacy vendor-poller devices); their readings and old columns are kept.
   Then confirm: `select state, count(*) from sensor_devices group by 1;` (all existing devices DEACTIVATED) and `select count(*) from zones;` (six per non-deleted facility).
   **Check no legacy device is still live** (run after the migration, and again after step 4; the result must be `0`): `select count(*) from sensor_devices d where d.state = 'ACTIVE' and d."createdAt" < (select finished_at from _prisma_migrations where migration_name = '20261030090000_sensor_fleet_management');` (an ACTIVE device older than the migration is a pre-fleet one). A non-zero count means a pre-fleet device accepts data from anyone holding the shared key.
   **Between the migration and the new API (step 4):** the migration keeps the old `status` and `zone` columns (the previous API build still reads them), so sensor endpoints keep answering. The previous build does not know about device states, so the legacy device may still appear in its tenant's view until step 4. The unused columns are dropped by a later migration, in a following release — once no previous build can be running.
3. **Set the ingest key** on the VPS: generate with `openssl rand -hex 32`, add `SENSOR_INGEST_API_KEY=<value>` to the VPS `.env` (`infra/vps/bintracker-api/.env`). Never commit it, and keep it out of any repo, document or `.env.example`. Restrict access to that file. If it is unset, every device gets `401` and nothing fails loudly.
4. **Deploy the API** with `infra/vps/bintracker-api/deploy.sh` (blue-green).
5. **Confirm the legacy EcoSafeSense device is DEACTIVATED** (id `de057baa-358c-430c-9f00-ccf7ee7834bc`; the migration did it). In **Sensor Fleet** it shows as Deactivated; its readings are kept, its tenant no longer sees it, and ingest rejects its id with `404`. Re-run the check from step 2. Reactivate it only on purpose.
6. **Stop the old poller container**: `docker rm -f bintracker_sensor_poller`. Removing the service from `docker-compose.yml` does not stop a container that is already running.
7. **Clean the old settings** from the VPS `.env`: `ECOSAFESENSE_BASE_URL`, `ECOSAFESENSE_CLIENT_ID`, `ECOSAFESENSE_CLIENT_SECRET`, `ECOSAFESENSE_DEVICE_ID`, `ECOSAFESENSE_BACKFILL_LOOKBACK_DAYS`, `SENSOR_FACILITY_ID`, `SENSOR_ORG_SLUG`, `SENSOR_DEVICE_LABEL`, `SHARED_SENSOR_DEVICE_IDS` (now ignored), and `VITE_ZONE_SENSOR_WETAGING` in the web build environment (Netlify).

## Bring devices online
8. In **Sensor Fleet → Register devices**, paste the vendor's device ids, one per line (commas, semicolons and tabs also separate; an id containing a space is reported as invalid). Ids that are bad or already registered are reported, not fatal. Devices that already post with ids you did not register show under **Unknown ids** with a sample of what they sent: select the real ones and **Add selected**, and **Dismiss** or **Clear all** the strays.
9. Assign each device to an organization, facility and zone, and give it a name the tenant will see. If the organization does not have **Environment Monitoring**, the form offers to enable it.
10. Give the firmware team the URL (`docs/sensor-push-ingest/DEVICE_UPLINK.md`) and the key through a secure channel.
11. Watch the device's page: it shows "Waiting for first reading" until data arrives, then the latest reading, signal charts and any fault. A `404 unknown device` seen in the log means an id was not registered; it appears under **Unknown ids** with a count.

## What changes for users
- A tenant sees **temperature and humidity only**, by device name, from the moment the device was assigned to them. Hardware ids, signal strength, fault detail and raw payloads are admin-only.
- Organizations with no assigned device now see the **mock** readings on Kill Floor / Wet Aging, where before every organization saw the one shared vendor sensor.
- A zone with several devices shows each one under its own name; a user with several facilities opens a zone on the facility that has a sensor.
- Sidebar zones come from the database; the six existing zones are seeded so current links keep working, and platform admins can add, rename and reorder zones.

## Not covered here
Hardening and open questions (`trustProxy`, a boot-time check for the key, a per-device throttle, retention, thresholds, send interval) are tracked in `BACKLOG.md` and `OPEN_ITEMS.md`.
