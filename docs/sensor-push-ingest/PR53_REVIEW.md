# PR #53 review — sensor fleet management spec

> Verbatim copy of the review comment by aymanabattar on PR #53
> (https://github.com/Next-Phase-Biosolutions/Bin-tracking/pull/53), saved so the
> implementation plan can reference it. Do not edit; record decisions in the plan.

## Fixes and implementation for this PR

Agreed with Ayman after reviewing this PR against the `sensor-integration-testing` prototype (diff review only; the code was not run). Please do all of the following in this PR.

### A. Fixes to the current PR

1. **Id rules.** `register:sensor-device` rejects ids under 16 characters, so the vendor's sequential ids can't be registered. Remove the length floor. Keep a character allowlist and a maximum length, and enforce them at ingest, not only in the CLI. Update the PR description, which presents the id as a secret.
2. **Tenant responses.** `sensor.getReadings` returns whole rows to tenants, now including `rawPayload` of up to 10KB, and `sensor.listDevices` returns `externalId`. Select only the tenant-safe fields: temperature, humidity, timestamp, status, last seen, device name, zone and facility. Select only the needed columns for chart queries.
3. **Legacy EcoSafeSense device.** It stays `ACTIVE` with `zone = NULL`, and ingest accepts any ACTIVE device by id. Add a rollout step that sets it to not ACTIVE, keeping its readings and the old vendor columns.

### B. Data model and ingest

4. Make `organizationId` and `facilityId` nullable on `SensorDevice`. Add `assignedAt` and a device state: unassigned, active or deactivated. Include the migration.
5. Ingest accepts readings from unassigned and active devices, stores them, and returns 204. It rejects deactivated devices immediately. Ids that are not registered still get a 404 and nothing is stored.
6. Add a capped, expiring log of unknown ids that arrive with a valid key: id, first seen, last seen and count, with no payload. Show it to platform admins so they can spot typos in the vendor's list.
7. Add an audit record for adding, assigning, reassigning, deactivating, reactivating and zone changes, recording who did it and when. Follow the existing payroll audit pattern.

### C. Platform-admin API (all behind `platformAdminProcedure`)

8. `addDevices`: one id or a pasted list, with validation and duplicate handling.
9. `assignDevice`: organization, facility, zone and a required device name. Warn, or offer to enable, the `ENVIRONMENT_MONITORING` module if the organization lacks it.
10. `reassignDevice`, `deactivateDevice` and `reactivateDevice`. On reassignment, old readings stay with the previous tenant.
11. `listFleetDevices` (filters and pagination), `fleetSummary`, `deviceDetail` and `deviceReadings`. Ranges are 24 hours, 7 days and 30 days, with server-side downsampling.
12. Cross-tenant read endpoints return full rows, including device id, RSSI, SNR, filtered RSSI, error code and message, and raw payload. They are separate from the tenant endpoints.

### D. Tenant side

13. Tenants see readings only from `assignedAt` onward, never see unassigned or deactivated devices, and see the device name, never the id. The tenant dashboard stays limited to temperature and humidity charts, status and last seen.

### E. Platform admin screens (new pages under `features/admin`, reusing the chart components)

14. **Fleet page.** Summary tiles (devices by state, online, offline, in fault, readings in the last hour), a device table across all tenants with tenant, facility, zone, latest reading, last seen and status badge, filters, and a fleet-alert list. The online and offline threshold is a setting, because the send interval is not yet confirmed.
15. **Add and register.** Enter a single id or paste a list, an unassigned inbox, and the unknown-id list.
16. **Assign form.** Pick organization, facility and zone, and give the device a name. Reassign and deactivate actions. Device ids are shown only on admin screens.
17. **Device detail.** Status banner with "waiting for first reading" before data arrives, the latest reading with every field, charts for temperature, humidity, RSSI, SNR and filtered RSSI, a readings table, the raw payload, fault history, and auto-refresh. Use it to confirm data is arriving.
18. **"View as tenant" mode** showing exactly what that tenant sees.
19. **Fault display.** Show `errorCode`, signal values and the raw payload to admins, and let a fault affect the admin status. Tenant views are unchanged.

### F. Configurable zones

20. A `Zone` table managed by platform admins (create, rename, reorder, remove), with a platform-admin editing screen. Whether a zone belongs to a facility or the whole organization is still open; the recommendation is per facility.
21. `SensorDevice.zone` becomes a reference to a zone row, validated at assignment. Replace `SENSOR_ZONE_IDS`.
22. A generic sensor view for any zone with no mock content, and the sidebar and routes reading zones from the database instead of `nav.ts` and `facility-zones-data.ts`.
23. A migration that seeds the six current zones (Receiving, Kill Floor, Processing, Wet Aging, Value Add, Shipping) for existing tenants, so existing links keep working.

### G. Tests

24. Tenancy isolation: tenants never see unassigned or deactivated devices, other tenants' devices, or readings from before `assignedAt`.
25. Tenant response test: no tenant response contains `rawPayload`, `rssi`, `snr`, `filteredRssi`, `errorCode`, `errorMessage` or `externalId`.
26. A non-platform-admin gets FORBIDDEN on every new admin procedure.
27. Ingest tests for each device state, including a deactivated device being rejected immediately.
28. Audit entries are written for every admin action, and reassignment leaves old readings with the previous tenant.

### H. Docs and rollout

29. Update `docs/sensor-integration/` files 00, 01, 08 and 10, which still describe the poller and the shared device.
30. Update the firmware document: new URL and key, status codes 401 (bad key), 404 (unregistered device), 413 (body too large), 429 (rate limited) and 500 (server error), and no device-side read-back.
31. Rollout notes: remove the old poller container, delete the old env vars from the VPS `.env`, and keep the real key out of every repo and `.env.example`.
32. The CLI can stay as a developer tool, but the platform admin screens become the normal way to register devices.

### Also before merge
- Run the migrations against a prod-shaped database or staging.
- Open the Wet Aging page in a browser with a registered device and confirm the charts render.
- Post a real reading from firmware to the deployed endpoint.

Not part of this ask, kept as backlog by Ayman: hardening (`trustProxy`, the `validateEnv` check, per-device throttle, HTTPS only), the sequential-id risk, and the open questions (flash lock and TLS verification, zone ownership, send interval, tenant fault badge, retention, thresholds, which zones show sensors, firmware behavior on a 404).

## Backlog (not scheduled, kept by Ayman)

### Hardening (unconfirmed)
- Set `trustProxy` so the rate limit is per client IP, not one shared bucket behind Caddy. If unset, all clients behind Caddy may share one bucket and could lock out the fleet.
- Add `SENSOR_INGEST_API_KEY` to `validateEnv` so production fails to boot without it. Today every device would silently get 401.
- Per-device write throttle.
- HTTPS only; confirm devices verify certificates.

### Accepted risk (low priority for now)
- Sequential device ids combined with a key that can never change: anyone holding the key can guess valid ids and send readings for registered devices.
- Unverified assumption: only the vendor and the platform admin hold the key. It is hard-coded in units at customer sites, so this holds only if the firmware protects it.
- If that can't be confirmed, treat the key as public: the vendor flashes random `p_device_id` values and keeps the sequential serial in a separate "vendor serial" field, and the per-device throttle moves up in priority.
- Keep the real key out of every repo, including the firmware document and `.env.example`, and restrict access to the VPS `.env`.

### Future
- Ask the vendor to flash unguessable device ids and keep serials in a "vendor serial" field.

### Other
- The unknown-id 404 versus 204 for registered ids lets a key holder probe which ids exist.
- Retries without `p_timestamp` get a fresh server timestamp each time, so they don't collapse into one row.

## Open items (unanswered)

1. **Vendor firmware:** does it lock flash readout (or encrypt the firmware), and does it verify the server's TLS certificate? This decides whether sequential ids are safe.
2. **Zones:** does a zone belong to a facility or to the whole organization? Recommendation: per facility.
3. **Send interval** from the vendor, needed for the online, offline and stale thresholds. The current 20 minutes assumes the old vendor.
4. **Tenant fault indicator:** a generic "sensor fault" badge, or nothing.
5. **Retention:** how long readings are kept.
6. **Real temperature and humidity thresholds** to replace the placeholders.
7. **Which zones show sensor data.** Only Kill Floor and Wet Aging are built out today.
8. **Firmware behavior** on a 404 or any other non-204 response.


## Please create a folder for the backlog and open items

Create `docs/sensor-push-ingest/` in this PR, on `feat/sensor-push-ingest`, with these two files, so the backlog and open items live in the repo and not only in this comment.

<details>
<summary><code>docs/sensor-push-ingest/BACKLOG.md</code></summary>

````markdown
# Backlog (not scheduled)

## Hardening (unconfirmed)
- Set `trustProxy` so the rate limit is per client IP, not one shared bucket behind Caddy. If unset, all clients behind Caddy may share one bucket and could lock out the fleet.
- Add `SENSOR_INGEST_API_KEY` to `validateEnv` so production fails to boot without it. Today every device would silently get 401.
- Per-device write throttle.
- HTTPS only; confirm devices verify certificates.

## Accepted risk (low priority for now)
- Sequential device ids combined with a key that can never change: anyone holding the key can guess valid ids and send readings for registered devices.
- Unverified assumption: only the vendor and the platform admin hold the key. It is hard-coded in units at customer sites, so this holds only if the firmware protects it.
- If that can't be confirmed, treat the key as public: the vendor flashes random `p_device_id` values and keeps the sequential serial in a separate "vendor serial" field, and the per-device throttle moves up in priority.
- Keep the real key out of every repo, including the firmware document and `.env.example`, and restrict access to the VPS `.env`.

## Future
- Ask the vendor to flash unguessable device ids and keep serials in a "vendor serial" field.

## Other
- The unknown-id 404 versus 204 for registered ids lets a key holder probe which ids exist.
- Retries without `p_timestamp` get a fresh server timestamp each time, so they don't collapse into one row.
````

</details>

<details>
<summary><code>docs/sensor-push-ingest/OPEN_ITEMS.md</code></summary>

````markdown
# Open items (unanswered)

1. Vendor firmware: does it lock flash readout (or encrypt the firmware), and does it verify the server's TLS certificate? This decides whether sequential ids are safe.
2. Zones: does a zone belong to a facility or to the whole organization? Recommendation: per facility.
3. Send interval from the vendor, needed for the online, offline and stale thresholds. The current 20 minutes assumes the old vendor.
4. Tenant fault indicator: a generic "sensor fault" badge, or nothing.
5. Retention: how long readings are kept.
6. Real temperature and humidity thresholds to replace the placeholders.
7. Which zones show sensor data. Only Kill Floor and Wet Aging are built out today.
8. Firmware behavior on a 404 or any other non-204 response.
````

</details>

When an open item is answered, move the answer into the PR description or the relevant doc and remove it from `OPEN_ITEMS.md`.

```bash
git checkout feat/sensor-push-ingest
git pull origin feat/sensor-push-ingest
mkdir -p docs/sensor-push-ingest
# create BACKLOG.md and OPEN_ITEMS.md with the contents above, then:
git add docs/sensor-push-ingest
git commit -m "docs(sensors): add backlog and open items for push ingest"
git push origin feat/sensor-push-ingest
```
