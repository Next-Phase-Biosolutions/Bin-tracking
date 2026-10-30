# Sensor firmware stub

A zero-dependency Node script that behaves like the sensor firmware described in the firmware handoff document (`sensor-integration-testing`, `docs/device-uplink-reference.html`): it posts readings with an `apikey` header and the `p_`-prefixed JSON body, and expects `204` on success.

It is a test tool. It holds no key; pass one with `--key` or the `SENSOR_INGEST_API_KEY` environment variable.

## Run

```bash
# one reading from each of the six simulated devices
SENSOR_INGEST_API_KEY=<key> node tools/sensor-firmware-stub/firmware-stub.mjs \
  --url http://127.0.0.1:3001/ingest/sensor-reading

# three rounds, one second apart, only two devices
node tools/sensor-firmware-stub/firmware-stub.mjs --key <key> \
  --devices master-01,master-03 --rounds 3 --interval 1000
```

Each line of output is JSON: `{ round, device, status, body, ms }`.

## Simulated devices

| Device id | Profile | What it sends |
|---|---|---|
| `master-01`, `master-02` | cooler | about 3 C and 85 % humidity, no fault |
| `master-03` | warm | 24 to 34 C, trips warning and alert thresholds |
| `master-04` | sensorFault | no temperature or humidity, error 100 "sensor read timeout" |
| `master-05` | radioFault | normal readings, weak RSSI, error 202 |
| `master-06` | lowBattery | normal readings, battery 2850 mV, error 300 |

None of these ids exist until an admin registers them (Sensor Fleet, Register devices) or accepts them from the Unknown ids list. Before that, the endpoint answers `404` and stores nothing.

## Library use

```js
import { reading, send, buildPayload, FLEET } from './firmware-stub.mjs';
const out = await reading({ url, key, deviceId: 'master-01' });   // { status, body, request }
const raw = await send({ url, key, body: { p_device_id: 'x', p_raw: {} } }); // any body, any key
```

## Other target

The same body works against the prototype's Supabase endpoint (`https://<ref>.supabase.co/rest/v1/rpc/ingest_reading`, header `apikey`). That target has not been exercised from this repo.
