# Rollout

Order matters. The database migrations must run **before** the API is deployed: the new API reads columns that do not exist until they have.

## Before merging
- [ ] Human review of PR #53 (an unauthenticated, key-gated endpoint plus platform-admin tooling).
- [ ] Run both new migrations against a prod-shaped database or staging and check the backfill (below).
- [ ] Open a zone page in a browser with a registered device and confirm the charts render.
- [ ] Post a real reading from firmware to the deployed endpoint (the step that needs the key).

## Deploy
1. **Back up** the production database (Supabase point-in-time recovery or a dump). The migrations drop the old `sensor_devices.status` and `.zone` columns after copying their data; there is no automatic down-migration, so rollback means restoring the backup.
2. **Run the migrations** on production: `pnpm db:migrate` (`prisma migrate deploy`). Two new ones apply:
   - `20261029120000_sensor_push_ingest_columns` — nullable `tempC` / `humidityPct`, and the radio / fault / raw-payload columns. Relaxes a constraint and adds columns only.
   - `20261030090000_sensor_fleet_management` — device states and `assignedAt`, per-facility `zones` (the six defaults seeded for every existing facility), `zoneId`, reading `organizationId` (backfilled from each device), the unknown-id log, audit log and platform settings tables, and a CHECK that an ACTIVE device is assigned.
   Then confirm: `select state, count(*) from sensor_devices group by 1;` and `select count(*) from zones;` (six per non-deleted facility).
3. **Set the ingest key** on the VPS: generate with `openssl rand -hex 32`, add `SENSOR_INGEST_API_KEY=<value>` to the VPS `.env` (`infra/vps/bintracker-api/.env`). Never commit it, and keep it out of any repo, document or `.env.example`. Restrict access to that file. If it is unset, every device gets `401` and nothing fails loudly.
4. **Deploy the API** with `infra/vps/bintracker-api/deploy.sh` (blue-green).
5. **Deactivate the legacy EcoSafeSense device** from **Sensor Fleet** (id `de057baa-358c-430c-9f00-ccf7ee7834bc`). After the migration it is still ACTIVE and ingest accepts any ACTIVE device by id. Deactivating keeps its readings and the old vendor columns, hides it from its tenant and makes ingest reject it.
6. **Stop the old poller container**: `docker rm -f bintracker_sensor_poller`. Removing the service from `docker-compose.yml` does not stop a container that is already running.
7. **Clean the old settings** from the VPS `.env`: `ECOSAFESENSE_BASE_URL`, `ECOSAFESENSE_CLIENT_ID`, `ECOSAFESENSE_CLIENT_SECRET`, `ECOSAFESENSE_DEVICE_ID`, `ECOSAFESENSE_BACKFILL_LOOKBACK_DAYS`, `SENSOR_FACILITY_ID`, `SENSOR_ORG_SLUG`, `SENSOR_DEVICE_LABEL`, `SHARED_SENSOR_DEVICE_IDS` (now ignored), and `VITE_ZONE_SENSOR_WETAGING` in the web build environment (Netlify).

## Bring devices online
8. In **Sensor Fleet → Register devices**, paste the vendor's device ids. Ids that are bad or already registered are reported, not fatal.
9. Assign each device to an organization, facility and zone, and give it a name the tenant will see. If the organization does not have **Environment Monitoring**, the form offers to enable it.
10. Give the firmware team the URL (`docs/sensor-push-ingest/DEVICE_UPLINK.md`) and the key through a secure channel.
11. Watch the device's page: it shows "Waiting for first reading" until data arrives, then the latest reading, signal charts and any fault. A `404 unknown device` seen in the log means an id was not registered; it appears under **Unknown ids** with a count.

## What changes for users
- A tenant sees **temperature and humidity only**, by device name, from the moment the device was assigned to them. Hardware ids, signal strength, fault detail and raw payloads are admin-only.
- Organizations with no assigned device now see the **mock** readings on Kill Floor / Wet Aging, where before every organization saw the one shared vendor sensor.
- Sidebar zones come from the database; the six existing zones are seeded so current links keep working, and platform admins can add, rename and reorder zones.

## Not covered here
Hardening and open questions (`trustProxy`, a boot-time check for the key, a per-device throttle, retention, thresholds, send interval) are tracked in `BACKLOG.md` and `OPEN_ITEMS.md`.
