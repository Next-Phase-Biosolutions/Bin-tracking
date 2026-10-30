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
- Drop the deprecated `sensor_devices.status` and `.zone` columns (`legacyStatus` / `legacyZone` in `schema.prisma`) in a migration after the release that ships the fleet work, once no previous API build can be running.
- The unknown-id log keeps a sample (temperature, humidity, the first 200 characters of `p_raw`) of each unregistered id's latest request, visible to platform admins only. A flood of junk ids can still fill the 1000-id cap until an admin dismisses or clears them; a per-key rate limit or alert on the cap would catch that earlier.
- The unknown-id log still costs four queries per unknown request (prune, find, count, upsert). It only runs for unregistered ids and the table is capped, so it is left as is.
