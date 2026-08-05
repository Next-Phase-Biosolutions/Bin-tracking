# Action Item 5 — Sensor Router

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-router   ← this branch
```
Branch from `feature/sensor-integration`, after Action Item 4 (sensor service) is merged.

## What This Is
The tRPC-facing API surface: `listDevices` and `getReadings`, gated by real auth (`orgProcedure`) and real module gating (`requireModule`).

## What To Do
1. Create `packages/validators/src/sensor.schema.ts`:
```typescript
import { z } from 'zod';
export const listDevicesSchema = z.object({ facilityId: z.string().optional() });
export const sensorReadingRangeSchema = z.object({
  deviceId: z.string(),
  range: z.enum(['24h', '7d']).default('24h'),
});
```
**Must be re-exported from `packages/validators/src/index.ts`** — same omission risk as the thresholds file in Action Item 4.

2. Create `apps/api/src/routers/sensor.router.ts`:
```typescript
export const sensorRouter = router({
  listDevices: orgProcedure
    .use(requireModule('ENVIRONMENT_MONITORING'))
    .input(listDevicesSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.user || !ctx.orgRole) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const allFacilityIds = await getUserFacilityIds(ctx.user.id, ctx.prisma, ctx.orgRole, ctx.orgId);

      // Intersect, never replace — a client-supplied facilityId must narrow
      // the caller's own access, not substitute for it.
      const facilityIds = input.facilityId
        ? allFacilityIds.filter((id) => id === input.facilityId)
        : allFacilityIds;

      return sensorService.listDevicesForOrg(ctx.orgId, facilityIds);
    }),
  getReadings: orgProcedure
    .use(requireModule('ENVIRONMENT_MONITORING'))
    .input(sensorReadingRangeSchema)
    .query(({ ctx, input }) => sensorService.getDeviceHistory(ctx.orgId, input.deviceId, input.range)),
});
```
**Response shape note:** `listDevices` returns `{ companyTimezone, devices }`, not a bare devices array — this is what Action Item 4's service now returns, so this route is a pure passthrough of that shape. Action Item 8's frontend must destructure accordingly; treating the query result as an array directly will break.

**Two fixes from the earlier draft:**
- **Facility-filter authorization gap, fixed.** The original version replaced the caller's own facility-access list with the client-supplied `facilityId` whenever one was given — cross-org access was still blocked (`organizationId` stays ANDed in), but a user assigned only to Facility A could pass Facility B's id and read Facility B's devices, as long as both facilities were in the same org. This is the same class of bug this workstream exists to prevent, one level down. Fixed by intersecting, not replacing.
- **`ctx.user!.id` / `ctx.orgRole!` non-null assertions removed.** With `DISABLE_AUTH=true` (a real, supported local-dev mode in this repo's `context.ts`), `ctx.user` can legitimately be `null` and `orgProcedure` does not itself guard against that. The forced assertion would throw a raw `TypeError` instead of a clean `UNAUTHORIZED`. Guard explicitly instead.

Do **not** use `protectedProcedure` + `requireFacilityAccess()` — that middleware is dead code (a null-check only, not wired to any router) and reintroduces the exact tenant-isolation gap this workstream exists to avoid.

## Acceptance Criteria
- [ ] Both procedures use `orgProcedure`, not `protectedProcedure`
- [ ] Both procedures are gated with `requireModule('ENVIRONMENT_MONITORING')`
- [ ] Zod schemas live in `packages/validators` and are re-exported from its `index.ts`
- [ ] `facilityId` filtering intersects with the caller's own access list, never replaces it
- [ ] `ctx.user` / `ctx.orgRole` are null-checked, not force-asserted
- [ ] Calling either endpoint as a user with no `ENVIRONMENT_MONITORING` module returns a gated/denied response
- [ ] Calling `getReadings` with a foreign-org `deviceId` returns `NOT_FOUND`
- [ ] A user restricted to Facility A cannot read Facility B's devices via the `facilityId` param, even within the same org

## Test Cases To Add
1. **Module-gating test** (mirror `require-module.test.ts`): org without `ENVIRONMENT_MONITORING` calling either endpoint is denied.
2. **Happy-path test**: org with the module, valid device, gets back readings.
3. **Facility-scope intersection test**: a WORKER assigned only to Facility A supplies Facility B's id (same org) — result must be empty, not Facility B's devices.
4. **`DISABLE_AUTH` null-context test**: confirm the router returns `UNAUTHORIZED` cleanly rather than throwing under `DISABLE_AUTH=true` with no user.

## How To Test
```bash
pnpm --filter @bin-tracker/api test sensor.router
```
Manually confirm the facility-intersection fix with two test users at different facility scopes within the same demo org.
