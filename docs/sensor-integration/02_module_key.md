# Action Item 2 — Add `ENVIRONMENT_MONITORING` Module Key

## Branch Tree
```
main
 └── feature/sensor-integration
      └── feature/sensor-module-key   ← this branch
```
Branch from `feature/sensor-integration` (can be branched in parallel with Action Item 1 once Item 1's schema PR is at least drafted, since this touches the same enum block).

## What This Is
Plugs the sensor feature into the existing plan/module gating system, so access to sensor data can be enabled per organization the same way `FORMS`, `PAYROLL`, etc. already are.

## What To Do — this is a 5-location change, not 2

`ModuleKey` is not just a Prisma enum — it's duplicated as a hand-maintained TypeScript union in `packages/types/src/entitlements.ts`, with two exhaustiveness-checked `Record<ModuleKey, ...>` maps. Missing any of these breaks the build, not just runtime behavior:

| # | Location | If missed |
|---|---|---|
| 1 | Prisma enum `ModuleKey` (`schema.prisma`) | Runtime error |
| 2 | `ModuleKey` TS union (`entitlements.ts`) | Type errors |
| 3 | `MODULE_KEY_SET` (`Record<ModuleKey, true>`) | **Won't compile** |
| 4 | `MODULE_LABELS` (`Record<ModuleKey, string>`) | **Won't compile** |
| 5 | `PLAN_DEFAULT_MODULES` (all 3 plan tiers) | Module never auto-provisioned |

Steps:
1. Add to the Prisma enum:
```prisma
enum ModuleKey {
  ANIMAL_INTAKE
  WORKFORCE
  SHIPMENTS
  FORMS
  FORMS_AI_DIGITIZE
  BLOCKCHAIN_ANCHOR
  PAYROLL
  ENVIRONMENT_MONITORING   // new
}
```
2. **Ship the `ADD VALUE` in its own migration, alone.** Postgres does not allow `ALTER TYPE ... ADD VALUE` and any statement that *uses* that new value in the same transaction — and Prisma wraps each migration in one transaction. If this migration adds the enum value **and** something else references `ENVIRONMENT_MONITORING` in the same migration file, it will fail. Add the value first, merge, then do everything else in a follow-up migration/PR.
3. Update all 5 locations listed above — the TS union, `MODULE_KEY_SET`, `MODULE_LABELS`, and `PLAN_DEFAULT_MODULES` for whichever plan tiers should include it by default. **`MODULE_LABELS.ENVIRONMENT_MONITORING = 'Environment'`** — `entitlements.ts` documents that these labels are matched 1:1 to the sidebar nav label so the admin panel, billing page, and upgrade prompt all agree, and Action Item 9's nav entry uses the label "Environment". Naming it explicitly here avoids the two drifting apart.
4. **Provisioning is automatic for new orgs only.** `reconcileModulesForPlan` (in `module-service.ts`) runs at org provisioning / plan-change time — it does **not** retroactively touch existing orgs. The demo org will not get this module automatically.
5. **For the demo org, use `setModuleOverride(prisma, { orgId, module: 'ENVIRONMENT_MONITORING', enabled: true, updatedBy })`, not raw SQL.** This writes `source: 'manual'`, which is designed to survive later plan reconciliation. A raw `INSERT` with `source: 'plan'` would get silently disabled the next time that org's plan is reconciled.
6. Be aware this is not purely additive to existing screens: `ALL_MODULE_KEYS` is derived from the map, so the platform-admin panel (`OrgModulesPage.tsx`) grows a new column, and `admin.router`'s zod enum grows a new value. This is correct, expected behavior — just don't be surprised by the diff, and check whether `entitlements.test.ts` needs updating for the new plan defaults.

## Acceptance Criteria
- [ ] `ENVIRONMENT_MONITORING` exists in the Prisma enum **and** all 4 corresponding locations in `entitlements.ts`
- [ ] The enum-value migration is its own migration, containing nothing else that references the new value
- [ ] Demo organization has this module enabled via `setModuleOverride` (verify `source: 'manual'` in the DB row, not `'plan'`)
- [ ] `OrgModulesPage.tsx` and `admin.router`'s zod enum are confirmed to pick up the new value (expected diff, not a regression)
- [ ] No changes to any *other* `ModuleKey` value or its existing behavior

## Test Cases To Add
1. **Module resolution test** — for the demo org, query its `OrganizationModule` rows and confirm `ENVIRONMENT_MONITORING` is present, `enabled: true`, `source: 'manual'`.
2. **Enum-migration isolation test** — confirm the `ADD VALUE` migration applies cleanly on its own, with no same-transaction usage of the new value.
3. **Existing-org non-regression test** — confirm a *different*, pre-existing org (not manually overridden) does NOT have this module, proving provisioning didn't silently backfill everyone.
4. **Gating test** (paired with Action Item 5's router) — an org without this module gets a gated/denied response from any sensor route.

## How To Test
```bash
pnpm --filter @bin-tracker/db migrate:dev --name add_environment_monitoring_module_value
# merge, then in a follow-up:
pnpm --filter @bin-tracker/db migrate:dev --name environment_monitoring_plan_defaults
```
Then, via a script or `tsx` REPL, call `setModuleOverride` for the demo org and confirm via Prisma Studio that the row has `source: 'manual'`.
