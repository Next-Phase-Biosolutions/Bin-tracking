# Frontend Handoff — Sensor Data (Environment Monitoring)

**Audience:** whoever is building the frontend for this feature. **Status:** the entire backend (Action Items 1–6) is built, live-tested against the real vendor API and a real running server, and merged. Nothing on the API side needs to change to build the UI. Action Items 7, 8, 9 (recharts install, dashboard page, nav/route) have **not** been started — that's the open work this document supports.

This is a reference for the data contract, not a page-layout spec. Wire the data in wherever it ends up being shown — a dedicated dashboard, a widget, whatever the design turns out to be.

---

## 1. Correction to `docs/sensor-integration/08_dashboard_page.md` — read this first

That doc says `latestStatus` is shaped `{ overall, byMetric }` and shows code like `device.latestStatus.overall` / `device.latestStatus.byMetric.temp`. **That shape does not exist in the implementation.** The actual, shipped, tested `latestStatus` is a **flat string**:

```ts
type ThresholdStatus = 'OK' | 'WARN' | 'ALERT' | 'UNKNOWN';
```

One status per device, not one per metric. This is confirmed three ways: the service code (`apps/api/src/services/sensor.service.ts`) returns a plain string; `computeThresholdStatus` (`packages/types/src/sensor-thresholds.ts`) has its own comment stating *"returns a single overall status rather than a per-metric breakdown — `{overall, byMetric}` is post-demo scope"*; and the passing test suite asserts `toBe('ALERT')`, a string, never `.overall`.

Everything else in docs 07/08/09 (recharts install/lazy-loading, the chart split, staleness handling, nav wiring) matches the real implementation and is safe to follow as written. This is the one place those docs are ahead of what actually got built.

---

## 2. The two endpoints

Both are `orgProcedure` (same auth as every other page — nothing special to configure) gated by `requireModule('ENVIRONMENT_MONITORING')` on the backend.

### `trpc.sensor.listDevices`

```ts
// input
{ facilityId?: string }   // optional — omit to get every device the caller can see

// output
{
  companyTimezone: string;   // e.g. "America/Toronto" — use this, see §5
  devices: Array<{
    id: string;
    organizationId: string;
    facilityId: string;
    externalId: string;      // vendor's device id
    label: string;           // "CMIT EcoSafeSense Sensor"
    status: string;          // "ACTIVE"
    lastSeenAt: string | null;   // ISO timestamp — see §6 (staleness)
    createdAt: string;
    readings: [SensorReading] | [];   // most recent ONE reading only, or empty array
    latestStatus: 'OK' | 'WARN' | 'ALERT' | 'UNKNOWN';   // see §1 — flat string
  }>;
}
```

`readings` here is capped to the single latest row — it's a summary field for cards/lists, not the chart data source.

### `trpc.sensor.getReadings`

```ts
// input
{ deviceId: string; range: '24h' | '7d' }   // range defaults to '24h' if omitted

// output
SensorReading[]   // oldest → newest, capped at 2000 rows
```

This is the chart data source. `range` is the only window supported server-side — there's no arbitrary date-range param.

### React usage (matches how every other page in this app calls tRPC — nothing new to learn)

```tsx
import { trpc } from '../../lib/trpc';

const { data, isLoading, error } = trpc.sensor.listDevices.useQuery(
  {},
  { refetchInterval: 60_000 }   // required — see §7, the page must visibly refresh
);
const { companyTimezone, devices } = data ?? { companyTimezone: 'America/Toronto', devices: [] };

const { data: readings } = trpc.sensor.getReadings.useQuery(
  { deviceId, range: '24h' },
  { refetchInterval: 60_000 }
);
```

`trpc` is the pre-configured client at `apps/web/src/lib/trpc.ts`. Auth headers, org headers, and the `DISABLE_AUTH=true` local-dev bypass are already handled there — no changes needed to call these endpoints.

---

## 3. `SensorReading` — every field, with real observed data

Pulled directly from the live database (132 real backfilled rows from the actual vendor device, `2026-07-28` → `2026-08-05`), not from docs or guesses:

| Field | Type | Threshold-monitored? | Observed range | Nulls seen | Unit |
|---|---|---|---|---|---|
| `timestamp` | `string` (ISO) | — | — | 0 | — |
| `tempC` | `number` | ✅ core | 24.11 – 33.95 | 0 (never null) | °C |
| `humidityPct` | `number` | ✅ core | 28.12 – 51.79 | 0 (never null) | % |
| `nh3Ppm` | `number \| null` | ✅ core | 0.0000 – 0.1006 | 0 | ammonia, ppm |
| `tvoc` | `number \| null` | ❌ air-quality | 12 – 315 | 0 | total volatile organic compounds |
| `eco2Ppm` | `number \| null` | ❌ air-quality | 400 – 806 | 0 | equivalent CO2, ppm |
| `aqhiPlus` | `number \| null` | ❌ air-quality | 1 – 3 | 0 | vendor's air-quality health index |
| `ozonePpb` | `number \| null` | ❌ air-quality | 0 – 40 | 0 | parts per billion |
| `pressure` | `number \| null` | ❌ air-quality | 986.76 – 1002.94 | 0 | hPa |
| `pm25` | `number \| null` | ❌ air-quality | 0 – 26 | 0 | particulate matter 2.5, µg/m³ |

Only `tempC` / `humidityPct` / `nh3Ppm` feed into `latestStatus`. The other six are captured and should be charted, but are never alert-gated — there are no defined thresholds for them yet (placeholder-values problem, tracked separately, not blocking the UI).

Types allow `null` on 7 of the 9 metrics (`Float?` in the schema), but in the actual dataset **none are currently null**. Build with the null-safety the types require, but don't expect to see it triggered in the demo data.

### Real example row

```json
{
  "id": "cmsggi1gj004rt0s5vn02f5g3",
  "deviceId": "cmsgc2tjg0000hvs5y6o5rhtg",
  "timestamp": "2026-08-05T19:01:30.000Z",
  "tempC": 32.13,
  "humidityPct": 30.22,
  "nh3Ppm": 0.0502,
  "tvoc": 22,
  "eco2Ppm": 400,
  "aqhiPlus": 1,
  "ozonePpb": 20,
  "pressure": 1001.53,
  "pm25": 8
}
```

### Real example `listDevices` response

```json
{
  "companyTimezone": "America/Toronto",
  "devices": [{
    "id": "cmsgc2tjg0000hvs5y6o5rhtg",
    "organizationId": "cmsg8duoq0005q4s5enxgkoun",
    "facilityId": "cmsgbucd70000fas5yf2cs5km",
    "externalId": "de057baa-358c-430c-9f00-ccf7ee7834bc",
    "label": "CMIT EcoSafeSense Sensor",
    "status": "ACTIVE",
    "lastSeenAt": "2026-08-05T18:37:10.000Z",
    "createdAt": "2026-08-05T17:01:01.321Z",
    "readings": [{ "tempC": 32.62, "humidityPct": 31.39, "nh3Ppm": 0.0538,
                   "tvoc": 35, "eco2Ppm": 425, "aqhiPlus": 2, "ozonePpb": 20,
                   "pressure": 1001.94, "pm25": 10,
                   "timestamp": "2026-08-05T18:37:10.000Z" }],
    "latestStatus": "ALERT"
  }]
}
```

(`ALERT` here is real — ammonia/temp were past the placeholder threshold at that moment. Not a fabricated example.)

---

## 4. Status badges — use the existing primitive, don't build a new one

`apps/web/src/components/ui/primitives.tsx` already exports `Badge`, with tones `good` / `warn` / `alert` / `idle` mapped to this app's actual palette. Map `latestStatus` straight onto it:

```tsx
import { Badge } from '../../components/ui/primitives';

const TONE = { OK: 'good', WARN: 'warn', ALERT: 'alert', UNKNOWN: 'idle' } as const;

<Badge tone={TONE[device.latestStatus]}>{device.latestStatus}</Badge>
```

**Map `UNKNOWN` to `idle`, never to `good`.** A device with no readings yet is `UNKNOWN` — a naive ternary that defaults anything-not-WARN/ALERT to green would show a confident "OK" on a device that has never reported. That's a worse failure than showing nothing.

For the 6 air-quality metrics (no thresholds), any per-metric badge should just always render `idle` — don't compute or imply a status for them that doesn't exist.

---

## 5. Timezone — use `companyTimezone` from `listDevices`, not `settings.get`

Every `timestamp` from the API is UTC. This app's convention for displaying org-local time is `Settings.companyTimezone` (default `"America/Toronto"`) — but **do not fetch it via `trpc.settings.get`**. That procedure is `orgAdminProcedure`-gated, so an `OPS_MANAGER` or `WORKER` opening this page would get a `FORBIDDEN` error before the page even renders.

Instead, `sensor.listDevices` already returns `companyTimezone` in its response (shown above) — that query runs on page load via the same `orgProcedure` every role can call. Bucket and label chart x-axes using that value.

---

## 6. Staleness — `lastSeenAt`

`SensorDevice.lastSeenAt` updates every backfill/poll cycle (every ~10 minutes when the poller is running), **even on a zero-new-rows cycle** — so it's a reliable "is this device actually being polled" signal, not just "when was the last reading."

Show it plainly (e.g. "Last seen 13h ago") and flag it visually past a threshold — the expected cadence is ~5–10 min, so anything past ~20 minutes stale is worth a visible warning. Real devices in this dataset have gone offline for 13h+ stretches during testing — don't let a chart that stopped updating hours ago look like it's live.

---

## 7. The page must actually refresh

The backfill/poll script writes new rows every 10 minutes whether or not anyone's looking at the dashboard. Without `refetchInterval`, the page freezes at whatever it looked like on load. Both queries need it:

```ts
trpc.sensor.listDevices.useQuery({}, { refetchInterval: 60_000 });
trpc.sensor.getReadings.useQuery({ deviceId, range }, { refetchInterval: 60_000 });
```

---

## 8. Chart guidance (if building a chart view)

- 9 separate charts, not one combined chart — temp/humidity can share a dual-axis chart since both are core and on comparable-ish scales; every other metric needs its own axis (ammonia's 0.0–0.1 range can't share a chart with eCO2's 400–800 range, and the 6 air-quality metrics have no consistent scale relationship to each other either).
- Render same-timestamp clusters as-is (multiple points at one x-position) rather than averaging or silently picking one. Not currently present in the live dataset (checked: 0 duplicate-timestamp rows right now), but the schema explicitly allows it and the vendor has confirmed it happens during device Wi-Fi setup — worth handling correctly rather than assuming it won't occur.
- Don't eagerly render all 9 charts — 9 `recharts` charts × up to 2000 points × a 60s refetch is real render load. Keep the 6 air-quality charts collapsed/unmounted until expanded; the 3 core charts (temp/humidity/ammonia) are what should be visible by default.

---

## 9. What already exists to reuse — don't rebuild these

| Need | Already exists at |
|---|---|
| Status badge | `Badge` / `badgeStyles` in `apps/web/src/components/ui/primitives.tsx` (tones: `good`/`warn`/`alert`/`idle`) |
| Route-loading spinner | `FacilityLoader` in `apps/web/src/components/app/FacilityLoader.tsx` — `variant="splash"` for full-page, `variant="inline"` for in-page |
| Nav icon | `'thermo'` already registered in `apps/web/src/**/Icon.tsx` — no new icon asset needed |
| Persisted-cache pattern (if you need one) | `apps/web/src/**/moduleCache.ts` is a clean example of the localStorage-cache-with-server-overwrite pattern already used elsewhere in this app |
| Lazy-loaded page pattern | `ShipmentsDashboardPage.tsx` — `export default function ShipmentsDashboardPage()`. Any lazy-loaded page **must** be a default export for `React.lazy(() => import(...))` to work |
| Where routes go | `apps/web/src/App.tsx` — the authenticated app lives inside `<Route element={<AppShellLayout />}>` (see the block starting at line 60). A handful of routes (`onboarding`, `invite`, `bank-details`) intentionally sit *outside* that shell — this page must **not** follow that pattern, or it renders with no sidebar and no auth guard |
| Nav config | `apps/web/src/config/nav.ts` — `operationsNav` array, `NavItem` interface uses **`href`**, not `path` |

This app currently has **zero** `React.lazy`/`<Suspense>` usage anywhere (confirmed — all current routes are static imports). This feature is the first one that needs it, so the `<Suspense>` boundary has to be added fresh, wrapping the component inside `element={}` — `<Suspense>` cannot be a direct child of `<Routes>`.

---

## 10. Module gating

The nav entry and the route should both respect `module: 'ENVIRONMENT_MONITORING'` — same pattern as `Shipments`/`Forms`/other gated nav items already in `nav.ts`:

```ts
{ label: 'Environment', href: '/app/sensors', icon: 'thermo', module: 'ENVIRONMENT_MONITORING' }
```

No `roles` restriction — every other module-gated nav item in this app gates on module alone, not role, and there's no stated reason environment data should be role-restricted beyond that.

Backend enforcement is already live and tested: if the org's module is off, both endpoints throw a `FORBIDDEN` (403) with a clear message — verified directly against the real API. In normal use the nav item just won't render for those orgs, so the frontend doesn't need custom error-state UI for this case, but a query `error` should still fail gracefully (not crash the page) if it's ever hit directly.

---

## 11. Local dev setup

- `DATABASE_URL` points at local Postgres (already running, already migrated, already has 132+ real readings for the demo device).
- `DISABLE_AUTH=true` is set in `.env` — no login needed locally, the API auto-injects an admin user.
- API: `pnpm --filter @bin-tracker/api dev` (port 3001).
- Web: `pnpm --filter @bin-tracker/web dev`.
- Real data is already backfilled — no need to run the backfill script to see something on screen. Org `default`, device `CMIT EcoSafeSense Sensor`, facility `cmsgbucd70000fas5yf2cs5km`.
- `apps/web` has no test harness configured yet (no `test` script, no vitest/testing-library). Treat docs 08/09's "test cases" sections as manual QA checklists, not something CI will enforce, unless standing up that harness is separately taken on.
