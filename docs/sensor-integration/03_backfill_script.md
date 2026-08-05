# Action Item 3 — Historical Backfill + 10-Min Repeat Poll (Demo)

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-backfill-script   ← this branch
```
**Branch from `feature/sensor-integration`, after Action Item 1 (schema) is merged — runs in parallel with Action Item 4, not after it.** This item does not depend on the sensor service/threshold function (that dependency existed in an earlier draft but no longer applies — this script never computes or stores threshold status, per Action Item 1). Its only real dependency is the schema. This matters operationally: this script is the long pole for the demo — it needs to be running and populated with real data well before the walkthrough — so don't block it behind Action Item 4 unnecessarily.

## What This Is
A script that (1) does an initial historical backfill from EcoSafeSense's `/download` endpoint so the dashboard has real data immediately, and (2) then repeats every 10 minutes for the rest of the demo window, pulling any new readings since the last run. This is a demo-scoped stand-in for a full BullMQ worker (a future, separate item) — a simple interval loop, not production infrastructure.

Both EcoSafeSense devices are currently offline (confirmed: `de057baa` last reported 13+ hours ago as of last check), so in practice the 10-min poll will mostly return zero new rows during the demo window — that's fine and expected; log it clearly rather than treating it as an error.

**Confirmed on vendor call (Aug 5):** a 10-minute poll interval is within the vendor's rate limit (an unspecified DDoS-prevention limit exists server-side; 5–10 minutes was explicitly confirmed safe by their software lead). Also confirmed: if the device has been offline and reconnects, it uploads backlogged readings in batches of ~10 per 5-minute upload cycle until caught up — a single poll during this catch-up period can legitimately return a burst of readings spanning a much wider time range than the poll interval itself, with timestamps from whenever the device was actually offline. This is expected, not a bug — don't add logic that rejects or flags a poll response as anomalous just because it contains a wide timestamp spread; that's the backlog draining, not an error.

## What To Do
1. **Location and naming — follow this repo's actual convention.** Existing backfill scripts live at `packages/db/src/backfill-org.ts` / `backfill-forms.ts`, invoked via `backfill:org` / `backfill:forms` package scripts, and those scripts already carry `--env-file=../../.env` (this is what makes "credentials from env" actually work in practice). Create `packages/db/src/backfill-sensors.ts` and a matching `backfill:sensors` script — not `prisma/backfill-sensors.ts`.
2. **Put the vendor client in its own file, not buried in this script.** Create `packages/db/src/ecosafesense.client.ts` (or an equivalent shared location) containing the `client-token` auth call, the `/download` fetch, and the `ammonia_ppm` string→float parser. This script imports from there. When a future live-ingestion worker is built, it reuses this client instead of duplicating or rewriting it.
   - **Scope note — trust the API response, not verbal scope.** On the vendor call (Aug 5), the vendor's own software lead was uncertain which sensors are physically on this specific device (confirmed only temperature, humidity, ammonia, PM2.5 were originally scoped in for this client) — but this device's actual `/lastReading` response has independently returned real, non-zero values for `avg_tvoc`, `avg_eco2_ppm`, `avg_ozone_ppb`, `avg_pressure`, and `avg_aqhi_plus` too.
   - **Only 4 of the 9 fields are confirmed to work as `/download` query params** — `temperature_celsius`, `humidity`, `ammonia_ppm`, `aqhi_plus` (Action Item 1). The other 5 have only been seen in `/lastReading`'s response, never tried against `/download`. **Do not request all 9 in a single unconditional call** — if `/download` rejects unknown field names with a `400` rather than silently ignoring them, the entire backfill fails, including the 4 fields that do work, and the demo's only data source goes dark on one unverified request. Instead: on the first call, request all 9; if the response is not `200`, retry with just the 4 confirmed fields and log which fields were dropped. This is a five-line fallback that removes a single point of failure the rest of the demo depends on.
   - **Field-name mapping — write this down explicitly, it's the highest typo-risk part of this workstream.** Three different spellings exist for the same values across the API surface and the schema:

     | `/lastReading` response key | `/download` query param | Schema column |
     |---|---|---|
     | `avg_temperature_celsius` | `temperature_celsius` | `tempC` |
     | `avg_humidity` | `humidity` | `humidityPct` |
     | (not present) | `ammonia_ppm` | `nh3Ppm` |
     | `avg_tvoc` | `tvoc` | `tvoc` |
     | `avg_eco2_ppm` | `eco2_ppm` | `eco2Ppm` |
     | `avg_aqhi_plus` | `aqhi_plus` | `aqhiPlus` |
     | `avg_ozone_ppb` | `ozone_ppb` | `ozonePpb` |
     | `avg_pressure` | `pressure` | `pressure` |
     | (not present) | `pm_25` | `pm25` |

     **This script's parser reads `/download`'s response shape (the middle column), not `/lastReading`'s** — `/download` doesn't use the `avg_` prefix. `/download`'s actual key names for the 5 unconfirmed fields are unverified — the middle column above is the request param name, not a confirmed response key; verify the response keys once real data comes back, and update `ecosafesense.client.ts`'s parser to match exactly what's returned, not assumed from the param name.
3. Script logic:
   - Get a token via the client above.
   - Confirm device list via `GET /api/v1/sensors`, or use the known demo `deviceId`.
   - Call `/download` for the historical window, parse rows, insert into `SensorReading` **unaveraged, as-is** — do not collapse same-timestamp clusters (deliberate, pending vendor clarification).
   - Update `SensorDevice.lastSeenAt` to the most recent timestamp seen, on every cycle — including cycles with zero new rows, so staleness is measurable.
   - Do **not** compute or store a threshold status here — that's gone from the schema (Action Item 1); status is read-time only, via the service layer.
4. **Repeat every 10 minutes**, using an incremental cursor:
   - `from` = the timestamp of the last successfully inserted row (**inclusive**), `to` = now.
   - **Insert behavior depends on which option Action Item 1 step 3 chose:**
     - **If (b)** — the schema has `@@unique([deviceId, timestamp])` — use `prisma.sensorReading.createMany({ data: rows, skipDuplicates: true })`. That's the entire dedup mechanism; nothing else needed.
     - **If (a)** — no unique constraint — de-duplicate in-process, in memory, not as a per-row database lookup: fetch all existing rows for that device with `timestamp >= from` once at the start of the cycle, build a `Set` of `${timestamp}|${tempC}|${humidityPct}|${nh3Ppm}|${tvoc}|${eco2Ppm}|${aqhiPlus}|${ozonePpb}|${pressure}|${pm25}` from them — **all 9 captured fields, not just the original 3**, or two rows identical in temp/humidity/ammonia but differing in an air-quality field get silently dropped as false duplicates — then filter incoming rows against that set before inserting. (This relies on float equality round-tripping exactly through Postgres for these values, which it does — worth stating explicitly since the dedup logic depends on it.)
   - Either way, use an inclusive `from` boundary, not `>` — using `>` instead of `>=` would silently drop legitimate rows in the boundary timestamp cluster.
5. **Token handling — dynamic, not hardcoded.** Vendor confirmed on a call (Aug 5) that the token's advertised lifetime is in flux: it was found to be misconfigured at 1 hour on their side, and the vendor lead said he'd change it to 24 hours after that call, but gave no confirmed timestamp for when that change lands. **Do not hardcode a refresh interval based on either number.** Instead:
   - After obtaining a token, attempt to decode its JWT payload (`iat`, `exp`) and compute the actual validity duration. **This assumes the token is a decodable JWT — unverified.** Nothing confirms `/api/v1/auth/client-token` always returns a JWT rather than an opaque string; if it ever isn't, the decode throws. Wrap the decode in a try/catch: on success, use the half-life policy below; on failure, fall back to a conservative fixed 30-minute refresh interval and log loudly that the fallback is active, so the poller keeps running either way instead of crashing at startup.
   - **Re-authenticate at half that duration, not at expiry** — e.g. if the token is valid for 1 hour, refresh at 30 minutes; if the vendor's change lands and it becomes valid for 24 hours, refresh at 12 hours. This is a deliberate policy: never run right up to expiry regardless of what the advertised duration turns out to be, so a slow poll cycle or clock drift can't cause a mid-cycle 401.
   - Also re-authenticate reactively on any `401` response, independent of the scheduled half-life refresh, as a backstop.
   - Log the decoded duration once per token acquisition (e.g. `"token valid for 3600s, will refresh at 1800s"`) so a duration change on the vendor's side is visible in the logs rather than silently discovered.
6. **Run this as a supervised process — this repo already has the right place for it.** A hand-started `node` process dies with the terminal, on laptop sleep, or on any network blip, with nothing watching — unacceptable for a client demo where the whole point is a working pipeline. **This repo has no `pm2` anywhere** — deployment is Docker Compose on the VPS, and `infra/vps/bintracker-api/docker-compose.yml` already runs a supervised `worker` service (`restart: unless-stopped`, running `tsx src/worker.ts`). Two real options, in order of preference: (a) for the demo specifically, run it locally under `nohup ... &` and log loudly on every cycle; (b) for anything beyond the demo, add this poller as its own service in that same `docker-compose.yml`, beside `worker` — which also directly answers the cross-cutting note about the live pipeline having no stated production home, since that compose file is exactly where it belongs. Don't introduce `pm2` as a new tool this repo doesn't otherwise use.
7. **Assert `facility.organizationId === device.organizationId` here, not just in Action Item 1.** Action Item 1 states this requirement, but this script is the only place a `SensorDevice` actually gets created — the assertion has to live in the code that does the creating. Check it before inserting the device row; fail loudly if it doesn't hold.
8. ~~Sanity-check the threshold output~~ — **moved to Action Item 4.** `computeThresholdStatus` and `SENSOR_THRESHOLDS` both live in Item 4's file, not this one; this item's branch tree explicitly runs parallel to Item 4 and must not import from or edit its file. See Action Item 4 for this check.
9. If choosing `tsx`'s own restart-on-change flag for local dev, don't call it `--watch` in documentation/scripts — that's also a real `tsx` flag and the overlap is confusing. Pick an unambiguous name for any custom flag.

## Acceptance Criteria
- [ ] Script lives at `packages/db/src/backfill-sensors.ts`, run via a `backfill:sensors` package script
- [ ] Vendor auth/fetch/parse logic lives in a separate, reusable client file — not inline in this script
- [ ] `ammonia_ppm` string values are correctly parsed to floats — no `NaN` values land in the DB
- [ ] `SensorDevice.lastSeenAt` is updated on every poll cycle, including zero-new-row cycles
- [ ] Repeat polling uses an inclusive incremental `from` **and** in-process de-duplication on the full value tuple — confirmed no data loss and no unbounded duplicate growth at cluster boundaries
- [ ] Script runs under `nohup` (demo) or the `docker-compose worker`-style pattern (beyond demo), survives terminal close, and logs clearly on every cycle
- [ ] Credentials are read from environment variables only, never hardcoded

## Test Cases To Add
1. **Type-safety test** — `ammonia_ppm: "0.0909"` parses to `0.0909` (number).
2. **Malformed-input test** — an unparseable `ammonia_ppm` is skipped/logged, not inserted as `NaN`.
3. **Boundary-cluster dedup test** — simulate two consecutive polls where the second poll's `from` lands exactly on a multi-row timestamp cluster; confirm no duplicate rows are inserted and no rows from that cluster are lost.
4. **lastSeenAt update test** — confirm the field advances after a poll with new data, and stays unchanged (not reset/nulled) after a poll with zero new rows.
5. **Token-expiry-during-loop test** — simulate a `401` mid-loop and confirm re-authentication and successful retry, not a crash or silent stop.
6. **Half-life scheduling test** — mock a decoded token with a 3600s duration and confirm the scheduled refresh fires at 1800s, not at 3600s or some other hardcoded value; repeat with a mocked 86400s duration and confirm refresh fires at 43200s. Confirms the logic reads the actual token, not a hardcoded assumption.
7. **Opaque-token fallback test** — mock a token response whose payload isn't valid JWT (decode throws) and confirm the poller falls back to the fixed 30-minute interval and keeps running, rather than crashing at startup.
8. **`/download` field-probe fallback test** — mock a non-200 response for the 9-field request and confirm the script retries with just the 4 confirmed fields, logs which were dropped, and still successfully ingests data — rather than the whole backfill failing.

## How To Test
```bash
pnpm --filter @bin-tracker/db backfill:sensors
```
Then run it under `nohup ... &` for the actual demo window, and tail the log to confirm cycles are firing every 10 minutes. Verify:
```sql
SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM sensor_readings;
SELECT id, "externalId", "lastSeenAt" FROM sensor_devices;
```
