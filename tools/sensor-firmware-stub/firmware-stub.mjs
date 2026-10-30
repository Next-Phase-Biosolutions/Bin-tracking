#!/usr/bin/env node
// Firmware stub: simulates sensor nodes posting readings the way the firmware
// handoff doc (sensor-integration-testing/docs/device-uplink-reference.html) describes.
//
// Contract (identical for both targets, so the same devices work against either):
//   POST <url>   headers: apikey, Content-Type: application/json
//   body: p_device_id, p_raw, p_temp_c, p_humidity_pct, p_rssi, p_snr,
//         p_filtered_rssi, p_error_code, p_error_message        -> 204 on success
//
// Targets:
//   bintracker  POST http://127.0.0.1:3001/ingest/sensor-reading            (header: apikey)
//   supabase    POST https://<ref>.supabase.co/rest/v1/rpc/ingest_reading   (header: apikey)
//   (The supabase target was NOT exercised in this session: the host is blocked
//    by the sandbox network policy. The body it sends is the same.)
//
// CLI:
//   node firmware-stub.mjs --url URL --key KEY [--devices master-01,master-02]
//        [--rounds 3] [--interval 1000] [--profile-from-id]
//   Library: import { send, FLEET, buildPayload } from './firmware-stub.mjs'

export const FLEET = {
  // id          profile                 what it simulates
  'master-01': { profile: 'cooler' },       // healthy wet-aging cooler, ~3 C / 85 %
  'master-02': { profile: 'cooler' },       // second healthy cooler
  'master-03': { profile: 'warm' },         // room-temperature node, trips WARN/ALERT thresholds
  'master-04': { profile: 'sensorFault' },  // temp/humidity read timeout: fault-only reading
  'master-05': { profile: 'radioFault' },   // good temp/humidity but weak link: error 202
  'master-06': { profile: 'lowBattery' },   // good readings, error 300
};

const rnd = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
const boot = {};

export function buildPayload(deviceId, profile = FLEET[deviceId]?.profile ?? 'cooler') {
  boot[deviceId] = (boot[deviceId] ?? 40) + 0;
  const base = {
    p_device_id: deviceId,
    p_raw: { battery_mv: 3700, boot_count: boot[deviceId], fw: 'stub-1.0' },
    p_rssi: rnd(-95, -60),
    p_snr: rnd(4, 11),
    p_filtered_rssi: rnd(-90, -62),
    p_error_code: 0,
  };
  switch (profile) {
    case 'cooler':
      return { ...base, p_temp_c: rnd(2.5, 4.5), p_humidity_pct: rnd(80, 90) };
    case 'warm':
      return { ...base, p_temp_c: rnd(24, 34), p_humidity_pct: rnd(40, 55) };
    case 'sensorFault':
      return {
        ...base,
        p_raw: { ...base.p_raw, note: 'sensor read timeout' },
        p_error_code: 100,
        p_error_message: 'sensor read timeout after 3 retries',
      };
    case 'radioFault':
      return {
        ...base,
        p_temp_c: rnd(3, 4),
        p_humidity_pct: rnd(82, 88),
        p_rssi: rnd(-118, -110),
        p_error_code: 202,
        p_error_message: 'RSSI below usable threshold',
      };
    case 'lowBattery':
      return {
        ...base,
        p_raw: { ...base.p_raw, battery_mv: 2850 },
        p_temp_c: rnd(3, 4),
        p_humidity_pct: rnd(82, 88),
        p_error_code: 300,
        p_error_message: 'low battery',
      };
    default:
      throw new Error(`unknown profile ${profile}`);
  }
}

/** Send one raw body. Returns { status, body, ms }. Never throws on HTTP errors. */
export async function send({ url, key, body, headers = {}, rawBody }) {
  const t0 = Date.now();
  const h = { 'Content-Type': 'application/json', ...headers };
  if (key !== undefined && key !== null) h.apikey = key;
  const res = await fetch(url, { method: 'POST', headers: h, body: rawBody ?? JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text, ms: Date.now() - t0 };
}

/** Send one reading for a fleet device (or an explicit payload). */
export async function reading({ url, key, deviceId, payload, profile }) {
  const body = payload ?? buildPayload(deviceId, profile);
  const out = await send({ url, key, body });
  return { deviceId: body.p_device_id, request: body, ...out };
}

// ---------------- CLI ----------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n, d) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > -1 ? process.argv[i + 1] : d;
  };
  const url = arg('url', 'http://127.0.0.1:3001/ingest/sensor-reading');
  const key = arg('key', process.env.SENSOR_INGEST_API_KEY);
  const ids = (arg('devices') ?? Object.keys(FLEET).join(',')).split(',');
  const rounds = Number(arg('rounds', '1'));
  const interval = Number(arg('interval', '1000'));
  for (let r = 1; r <= rounds; r++) {
    for (const id of ids) {
      const out = await reading({ url, key, deviceId: id, profile: FLEET[id]?.profile });
      console.log(JSON.stringify({ round: r, device: id, status: out.status, body: out.body, ms: out.ms }));
    }
    if (r < rounds) await new Promise((res) => setTimeout(res, interval));
  }
}
