# Action Item 8 — Sensor Dashboard Page

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-dashboard-page   ← this branch
```
Branch from `feature/sensor-integration`, after Action Item 5 (router) and Action Item 7 (recharts) are merged.

## What This Is
The actual interactive dashboard: charts, latest-reading summary, and the visual centerpiece of the demo.

## What To Do
Create `apps/web/src/features/sensors/`:
- `SensorDashboardPage.tsx` — page shell, fetches `trpc.sensor.listDevices` and `trpc.sensor.getReadings`, split into two sections: **Core** (temperature, humidity, ammonia — threshold-monitored, status badge shown) and **Air Quality** (TVOC, eCO2, PM2.5, ozone, pressure, AQHI+ — captured and charted, but `idle` badge since no thresholds are defined for these yet per Action Item 4)
- `components/DeviceCard.tsx` — latest reading, big numbers, status badge, **and last-seen staleness** (see below)
- `components/ReadingChart.tsx` — recharts `LineChart`, one per metric (9 total: 3 core + 6 air-quality), not a single combined chart:
  - Temperature and humidity can share a chart with a dual y-axis if desired, since both are core; every other metric gets its own chart — ammonia's scale (0.07–0.10 ppm observed) can't share an axis with e.g. eCO2 (hundreds of ppm), and the six air-quality metrics have no consistent scale relationship to each other either
  - Render same-timestamp clusters as-is — multiple close points at one x-position — rather than silently averaging or picking one
  - Each of the 9 metric charts can show a per-metric badge; for the 6 air-quality metrics, that badge is always `idle` (no threshold exists for them yet, per Action Item 4) — don't compute or imply a status for them that doesn't exist

**Five corrections from the earlier draft:**

1. **No invented "no localStorage" convention — drop that instruction entirely.** This repo already uses `localStorage` in four places (`moduleCache.ts`, `trpc.ts` for selected-org-id, `AppShellLayout.tsx` for sidebar-collapsed state). Stating a convention that doesn't exist risks someone "fixing" working code elsewhere. Use whatever storage approach fits the component — react-query cache for server data, `useState` for ephemeral UI state, `localStorage` if there's a genuine reason to persist a UI preference, consistent with how the rest of the app already does it.

2. **The dashboard must actually refresh.** Action Item 3's poll writes new data to the DB every 10 minutes, but a page with no `refetchInterval` stays frozen at whatever it looked like on page load — during a live walkthrough this means the "live pipeline" visibly does nothing. Add:
```typescript
const { data } = trpc.sensor.listDevices.useQuery({}, { refetchInterval: 60_000 });
const { companyTimezone, devices } = data ?? { companyTimezone: 'America/Toronto', devices: [] };
// listDevices returns { companyTimezone, devices } — do NOT treat `data` itself as the devices array.
trpc.sensor.getReadings.useQuery({ deviceId, range }, { refetchInterval: 60_000 });
```

3. **Don't build a new `StatusPill` component — use the existing badge primitive.** `primitives.tsx` already ships `badgeStyles` with tones `good` / `warn` / `alert` / `idle` — a direct match for OK/WARN/ALERT in the app's own palette. `latestStatus` (Action Item 4) is now `{ overall, byMetric }`, not a flat string:
```tsx
const TONE = { OK: 'good', WARN: 'warn', ALERT: 'alert', UNKNOWN: 'idle' };
// DeviceCard reads latestStatus.overall
<Badge tone={TONE[device.latestStatus.overall]}>{device.latestStatus.overall}</Badge>
// Per-metric chart badges (core three only) read latestStatus.byMetric.temp / .humidity / .nh3
<Badge tone={TONE[device.latestStatus.byMetric.temp]}>{device.latestStatus.byMetric.temp}</Badge>
```
**Map `UNKNOWN` to `idle`, not to the `good`/green fallback.** A naive ternary (`status === 'ALERT' ? 'alert' : status === 'WARN' ? 'warn' : 'good'`) silently renders `UNKNOWN` as green "OK" — and since both real devices are currently offline, "no readings yet" (`UNKNOWN`) is the single most likely state during the demo. A confident green badge on a device with zero data is the worst possible failure mode here. Use an explicit lookup table, not a chained ternary, so every status has a deliberate mapping.

4. **State the timezone explicitly — and fetch it from the right place.** Readings come back as UTC. This repo's plant-level convention is `Settings.companyTimezone` (default `America/Toronto`). **Do not fetch it via `settings.get`** — that procedure is `orgAdminProcedure`-gated, so an `OPS_MANAGER` or `WORKER` opening this page would get `FORBIDDEN` the moment the page tries to load it, before the dashboard even renders. Instead, return `companyTimezone` as a field on `sensor.listDevices`'s response (Action Item 5) — that query already runs on page load via `orgProcedure`, which every role can call, and `ctx.orgId` is already resolved there. No new endpoint, no permission change. Bucket and label the chart's x-axis using that value, not raw UTC or browser-local.

5. **Surface device staleness.** Both real devices have been offline 13h+ during testing — this is exactly what `SensorDevice.lastSeenAt` (Action Item 1/3) exists for. Show it plainly on `DeviceCard` (e.g. "Last seen 13h ago"), so the demo doesn't present a frozen chart as if it were current. If staleness exceeds a threshold (e.g. 20 minutes given the ~5–10 min expected cadence), visually flag it — don't let a confident-looking chart imply live data when it isn't.

6. **Don't render all 9 charts eagerly.** Nine `recharts` `LineChart`s, each holding up to 2000 points, all re-rendering on a 60-second `refetchInterval`, is real load on the demo's critical rendering path. The Core (3 charts) / Air Quality (6 charts) split already separates these — keep the Air Quality section collapsed by default and only mount/render those 6 charts once the section is expanded. The core three are what the demo actually needs visible at all times.

## Acceptance Criteria
- [ ] Page renders with real backfilled data (not mock/placeholder data)
- [ ] All 9 captured metrics (3 core + 6 air-quality) each have their own chart, visually separated by scale — not just temp/humidity/ammonia
- [ ] `refetchInterval` is set on both queries — page visibly updates without a manual reload
- [ ] Status uses the existing `Badge`/`badgeStyles` primitive, no new status-color component
- [ ] Chart x-axis is labeled/bucketed in the org's `companyTimezone`, not raw UTC
- [ ] `lastSeenAt` is visible on the device card, with a clear stale-data indicator past a defined threshold
- [ ] Loading and empty states are handled

## Test Cases To Add
**Note: `apps/web` currently has no test tooling configured (no test script, no vitest/testing-library in `package.json`).** The following are correct in principle but cannot execute as automated tests until that harness exists — treat them as manual QA steps for the demo, not CI-enforced tests, unless standing up the test harness is explicitly taken on as separate work:
1. Render with a realistic `getReadings` response, including a same-timestamp cluster — confirm no crash, no silent data-picking.
2. Empty-state — no readings yet for a device.
3. Status-badge mapping at known threshold boundaries.
4. Staleness indicator — a device with `lastSeenAt` older than the threshold shows the stale flag.

## How To Test
```bash
pnpm --filter @bin-tracker/web dev
```
Navigate to the page locally and visually confirm against the real backfilled dataset from Action Item 3, including watching a `refetchInterval` cycle actually pull in new data if the backfill script has produced any in the meantime.
