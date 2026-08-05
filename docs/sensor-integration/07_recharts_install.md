# Action Item 7 — Install `recharts`

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-recharts-install   ← this branch
```
Branch from `feature/sensor-integration`. Independent of the backend items — can be done in parallel.

## What This Is
Adds the charting dependency needed for an interactive, demo-quality dashboard (hover tooltips, multi-metric display).

## What To Do
```bash
pnpm add recharts --filter @bin-tracker/web
```
Confirmed compatible: `recharts@3.10.1` declares `react: ^16.8 || ^17 || ^18 || ^19`, safe against this repo's React 19.

**Lazy-load it — with a `<Suspense>` boundary, which this app does not otherwise have.** `recharts` plus its `d3` dependencies is the single largest addition this feature makes to the app, against this app's <300 KB gz app-page budget. Import it via `React.lazy` on the sensors route specifically, so it doesn't land in every other page's bundle:
```typescript
const SensorDashboardPage = React.lazy(() => import('./features/sensors/SensorDashboardPage'));
```
**This app currently has zero `React.lazy`/`<Suspense>` usage anywhere — all 20+ pages are statically imported.** A lazy component with no `<Suspense>` ancestor throws at render time, and this app's Sentry error boundary will catch that throw and show its generic "Something went wrong" crash screen — a highly visible failure during a live demo. **The boundary must wrap the component inside `element={}`, not wrap the `<Route>` itself** — `<Suspense>` is not a valid child of `<Routes>`, and React Router will throw if it's placed there. Action Item 9 has the correct, working form of this — see that item for the actual snippet; it isn't repeated here to avoid two files drifting out of sync with each other.

This is the one and only place in the app that needs a `Suspense` boundary — don't add lazy-loading to any other route as a side effect of this pattern being introduced here. **`SensorDashboardPage` must be a default export** (`export default function SensorDashboardPage...`) for `React.lazy(() => import(...))` to work — this repo's page components already follow that convention (e.g. `ShipmentsDashboardPage.tsx`), so no deviation needed, just don't forget it.

## Acceptance Criteria
- [ ] `recharts` appears in `apps/web/package.json` dependencies, correctly scoped to `@bin-tracker/web`
- [ ] `pnpm install` at repo root completes cleanly
- [ ] No other package's dependencies are modified
- [ ] The sensors page component is lazy-loaded, not statically imported into the main bundle — verify via a bundle-size check, not just code inspection

## Test Cases To Add
None for the install itself. One check for lazy-loading: confirm (via build output / bundle analyzer) that `recharts` does not appear in the main app-shell chunk, only in a route-specific chunk.

## How To Test
```bash
pnpm install
pnpm --filter @bin-tracker/web build
```
Inspect the build output to confirm `recharts`/`d3` land in a separate chunk from the main bundle.
