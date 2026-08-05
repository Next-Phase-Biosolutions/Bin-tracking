# Action Item 9 — Nav Entry & Route Registration

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-nav-route   ← this branch
```
Branch from `feature/sensor-integration`, after Action Item 8 (dashboard page) is merged.

## What This Is
The final wiring step: a route in the app's router and a nav entry so the dashboard is actually reachable from the UI during the demo.

## What To Do
1. In `apps/web/src/App.tsx`, add the route **inside the authenticated app shell, and inside a `<Suspense>` boundary** (required because `SensorDashboardPage` is lazy-loaded per Action Item 7 — this app has no other lazy routes, so this boundary doesn't exist yet and must be added here). Imports needed: `Suspense` from `react`, and `FacilityLoader` from `apps/web/src/components/app/FacilityLoader.tsx` (this app's existing loading visual — don't build a new one):
```typescript
import { Suspense } from 'react';
import { FacilityLoader } from './components/app/FacilityLoader';
```
```typescript
<Route element={<AppShellLayout />}>
  {/* ...existing routes... */}
  <Route
    path="/app/sensors"
    element={
      <Suspense fallback={<FacilityLoader variant="splash" />}>
        <SensorDashboardPage />
      </Suspense>
    }
  />
</Route>
```
A handful of `/app/*` routes (onboarding, invite, bank-details) deliberately sit *outside* `AppShellLayout` in this repo — placed there by mistake, this page would render with no sidebar and no auth guard. It must go inside the shell like the other operational pages.

2. In `nav.ts`, add an entry to `operationsNav`, using the field names this repo's `NavItem` type actually has — **`href`, not `path`**:
```typescript
{ label: 'Environment', href: '/app/sensors', icon: 'thermo', module: 'ENVIRONMENT_MONITORING' }
```
`icon: 'thermo'` is already in the icon registry (`Icon.tsx`) — no new import needed.

**`roles` intentionally omitted.** Other module-gated nav items in this repo (Shipments, Forms, Animal Records) are module-gated only, with no `roles` restriction — module gating alone is the established pattern. Only add `roles` if there's a specific reason a `WORKER` shouldn't see environment data that doesn't apply to other gated features; don't add a placeholder array.

## Acceptance Criteria
- [ ] Route is flat (`/app/sensors`) and nested inside `<Route element={<AppShellLayout />}>`
- [ ] Nav entry uses `href`, not `path` — confirm the file actually type-checks
- [ ] Nav entry includes `module: 'ENVIRONMENT_MONITORING'`
- [ ] No placeholder/incomplete `roles` array — either a real, justified list or omitted entirely
- [ ] Nav item does not appear for a user whose org lacks the `ENVIRONMENT_MONITORING` module
- [ ] Navigating to `/app/sensors` shows the sidebar and enforces auth, same as other operational pages

## Test Cases To Add
**Same caveat as Action Item 8: `apps/web` has no test harness currently.** Treat as manual QA unless the harness is stood up separately:
1. Nav visibility — present for a module-enabled org, absent otherwise.
2. Route renders inside the shell (sidebar visible) and enforces the existing auth guard, not a blank/unguarded page.

## How To Test
```bash
pnpm --filter @bin-tracker/web build   # confirms href/path fix actually compiles
pnpm --filter @bin-tracker/web dev
```
Log in as the demo user, confirm the nav item appears with the sidebar intact, and the route loads the dashboard from Action Item 8 with real data.
