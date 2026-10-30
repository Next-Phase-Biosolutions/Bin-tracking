# Device uplink reference

How a sensor node sends a reading to Bin Tracker. This replaces the earlier prototype's Supabase endpoint: the body fields are the same, only the URL and key change.

There is **no read-back**. A device cannot fetch readings or list devices; to check that a reading landed, look at the device's page under **Sensor Fleet** (platform admins) or at the tenant's zone page.

## Request

```
POST https://api.nextphasebiosolutions.com/ingest/sensor-reading
apikey: <SENSOR_INGEST_API_KEY>
Content-Type: application/json
```

- **One shared key** authenticates the whole fleet. It identifies no customer: which organization a reading belongs to is decided only by the device id, which a platform admin registers and assigns beforehand.
- The key is a secret. It is **not** in this document, in any repository or in any `.env.example`. It is shared out of band, and changing it means re-flashing every unit.
- Send `Content-Type: application/json`. Any other content type is read as text and rejected with `400`.
- Use HTTPS only.

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `p_device_id` | string | yes | The device's own id. 1–64 characters: letters, digits, `-` and `_` only. Must be registered first. |
| `p_raw` | object | yes | Any JSON **object** (not an array or scalar) of extra debug context, e.g. battery voltage. Under 10,000 bytes when serialized; no NUL characters. Shown to platform admins only. |
| `p_temp_c` | number | no | Temperature, °C. |
| `p_humidity_pct` | number | no | Relative humidity, %. |
| `p_rssi` | number | no | Received signal strength, dBm. |
| `p_snr` | number | no | Signal-to-noise ratio, dB. |
| `p_filtered_rssi` | number | no | RSSI after the device's own smoothing. |
| `p_error_code` | integer | no | `0` or omitted = nominal reading; non-zero = a fault. |
| `p_error_message` | string | no | Short detail for a non-zero code. 500 characters at most; no NUL characters. |
| `p_timestamp` | string | no | When the reading was **taken**, ISO 8601 **with** an offset (`2026-10-30T10:00:00Z` or `+05:30`). Omit to use the server's receive time. Not more than 5 minutes in the future or 7 days in the past. |

Any field may be `null` instead of omitted. Unknown fields are ignored.

- **Faults:** still send the numeric fields you have. If the temperature sensor read fine and the humidity sensor timed out, send `p_temp_c` as usual and carry the fault in `p_error_code` / `p_error_message`. A reading with no temperature or humidity at all (both missing) is accepted.
- **Retries:** send `p_timestamp` whenever you can. Resending the **same device id and the same timestamp** is safe: it is stored once. A retry *without* a timestamp gets a fresh receive time each time and is stored again.

### Example

```bash
curl -X POST https://api.nextphasebiosolutions.com/ingest/sensor-reading \
  -H "apikey: $SENSOR_INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "MT-0001",
    "p_raw": { "battery_mv": 3712, "boot_count": 44 },
    "p_temp_c": 3.4,
    "p_humidity_pct": 82.1,
    "p_rssi": -67,
    "p_snr": 9.5,
    "p_timestamp": "2026-10-30T10:00:00Z"
  }'
```

Fault with no valid temperature or humidity:

```json
{ "p_device_id": "MT-0001", "p_raw": {}, "p_error_code": 100, "p_error_message": "sensor read timeout after 3 retries" }
```

## Responses

| Status | Meaning | Body | What the firmware should do |
|---|---|---|---|
| `204` | Stored. | none | Done. This is the only success. |
| `400` | The body is not acceptable. | `{"error":"<field>: <reason>"}` for validation (e.g. `p_device_id: only letters, digits, "-" and "_" are allowed`), or Fastify's `{"statusCode":400,"code":"FST_ERR_CTP_INVALID_JSON_BODY",…}` for malformed JSON | A bug in the payload; retrying the same body will fail the same way. |
| `401` | Missing or wrong `apikey`. | `{"error":"invalid api key"}` | Check the key. Do not retry in a tight loop. |
| `404` | `p_device_id` is not registered, **or** the device has been deactivated. | `{"error":"unknown device"}` | The two cases look the same on purpose. Ask a platform admin to register or reactivate the id. Back off rather than retry rapidly. |
| `413` | The request body is over 32 KB. | Fastify `Payload Too Large` | Send less (`p_raw` is capped at 10 KB anyway). |
| `429` | Too many requests (over 600 per minute from one address). | rate-limit error | Wait, then retry with back-off. |
| `500` | Server error. | `{"error":"internal error"}` | Retry later with back-off; include `p_timestamp` so a retry is not stored twice. |

Authentication is checked before the body is read, so a request with a bad key gets `401` whatever its body.

What to do on a `404` or any other non-`204` is still an **open question** for the firmware team (see `OPEN_ITEMS.md`, item 8).
