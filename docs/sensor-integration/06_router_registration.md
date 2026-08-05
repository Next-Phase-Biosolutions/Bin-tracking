# Action Item 6 — Router Registration

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-router-registration   ← this branch
```
Branch from `feature/sensor-integration`, after Action Item 5 (router) is merged.

## What This Is
The single shared-file touch that wires the new router into the app's existing `appRouter`. Deliberately kept as its own tiny action item because it's the one change that touches a file every other feature also depends on — isolating it makes the diff trivial to review and revert if needed.

## What To Do
In `apps/api/src/routers/index.ts`:
```typescript
import { sensorRouter } from './sensor.router.js';

export const appRouter = router({
  // ...existing routers, unchanged...
  sensor: sensorRouter,
});
```
That's the entire change. No other file should be touched in this branch.

## Acceptance Criteria
- [ ] `git diff` for this branch shows exactly one import line and one property added to `routers/index.ts` — nothing else
- [ ] All existing routers still resolve correctly (no accidental key collision, no existing router removed/reordered in a way that breaks anything)
- [ ] `sensor.listDevices` and `sensor.getReadings` are now reachable via the app's tRPC client

## Test Cases To Add
1. **Registration smoke test** — full app router type-checks and boots; a simple integration test calls `trpc.sensor.listDevices` end-to-end and gets a response (not a "no such procedure" error).
2. **Regression check** — run the full existing test suite once after this merge to confirm no existing router broke from the registration.

## How To Test
```bash
pnpm --filter @bin-tracker/api build   # type-check the merged router
pnpm --filter @bin-tracker/api test    # full suite, confirm nothing else broke
```
