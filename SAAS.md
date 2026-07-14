# Bin Tracker → Multi-Tenant SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-plant bin-tracker into a multi-tenant SaaS where organizations sign up and get access to individually-assignable modules (Animal Intake, Workforce, Shipments, Forms, AI Digitization, Blockchain Anchoring, Payroll — core bin tracking is unconditional), with complete data isolation between tenants. **Billing ships built but disabled at launch** (`BILLING_ENABLED=false`) — every client gets full access for free during early access; flipping one env var later turns on real Stripe checkout for new signups with zero rework, per Task 12/13/17/18.

**Architecture:** Shared database, shared schema multi-tenancy. A new `Organization` model sits above `Facility`; every tenant-owned table gets a direct `organizationId` column. All tRPC procedures resolve `ctx.orgId` from the caller (JWT user membership or station→facility chain) and every Prisma query is org-scoped. Stripe is the source of truth for plans; a webhook syncs into a local `Subscription` table and reconciles an `OrganizationModule` table (the real enforcement source of truth); a `requireModule` middleware gates every optional router; a platform-admin panel lets the operator override any org's modules independent of its plan tier. The API and all AI agents run self-hosted on a Hostinger KVM4 VPS — see the companion `kvmplan.md` for that setup.

**Tech Stack:** Existing (Fastify, tRPC v11, Prisma, PostgreSQL/Supabase, Supabase Auth, React/Vite, Turborepo) + new: `stripe` (npm), Resend (invite emails), Docker + Caddy + Cloudflare (self-hosted deploy, see `kvmplan.md`).

## Global Constraints

- Node >= 20, pnpm >= 9 (from root `package.json` engines).
- All new API code follows existing patterns: routers in `apps/api/src/routers/*.router.ts`, services in `apps/api/src/services/*.service.ts`, Zod schemas in `packages/validators/src`, shared types in `packages/types/src`.
- Every Prisma migration must be **additive-first** (nullable column → backfill → NOT NULL in a later migration). Production DB is live on Supabase; migrations run via the existing GitHub Actions deploy workflow.
- No tenant-owned query may omit org scoping. Rule: any `prisma.<model>.find*/update*/delete*/create` on a tenant table MUST include `organizationId` (or a relation filter that chains to it).
- Tests: Vitest, run with `pnpm --filter @bin-tracker/api test`. Existing examples: `apps/api/src/lib/merkle.test.ts`, `apps/api/src/services/attendance.service.test.ts` — follow their mocking style.
- Never commit secrets. New env vars go in `.env.example` with placeholder values.
- Commit after every green task, conventional commits format (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).

## Execution Order (dependency graph)

```
Phase 1 (auth hardening)  →  Phase 2 (org layer)  →  Phase 3 (billing/entitlements)
                                                  →  Phase 4 (onboarding)
Phase 5 (infra/ops) — independent, can run in parallel after Phase 1
```

Do NOT start Phase 3 before Phase 2 is complete: entitlements attach to organizations.

---

# Phase 1 — Auth Hardening (close the open doors first)

**Why first:** `employee`, `attendance`, `shipment`, `payroll`, `farmer`, and most of `form` routers are `publicProcedure` — no auth at all. In a SaaS this is every tenant's payroll data exposed. Also the `DISABLE_AUTH=true` bypass must be impossible in production.

### Task 1: Make the auth bypass refuse to run in production

**Files:**
- Create: `apps/api/src/lib/auth-flags.ts`
- Modify: `apps/api/src/trpc/context.ts:24`, `apps/api/src/trpc/trpc.ts:29,50`, `apps/api/src/trpc/middleware.ts:11,36,55`
- Test: `apps/api/src/lib/auth-flags.test.ts`

**Interfaces:**
- Produces: `isAuthDisabled(): boolean` — the ONLY sanctioned way to check the bypass flag. All 6 existing inline `process.env['DISABLE_AUTH'] === 'true'` checks are replaced with calls to it.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/auth-flags.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { isAuthDisabled } from './auth-flags.js';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe('isAuthDisabled', () => {
    it('returns true when DISABLE_AUTH=true outside production', () => {
        process.env['DISABLE_AUTH'] = 'true';
        process.env['NODE_ENV'] = 'development';
        expect(isAuthDisabled()).toBe(true);
    });

    it('returns false in production even when DISABLE_AUTH=true', () => {
        process.env['DISABLE_AUTH'] = 'true';
        process.env['NODE_ENV'] = 'production';
        expect(isAuthDisabled()).toBe(false);
    });

    it('returns false when DISABLE_AUTH is unset', () => {
        delete process.env['DISABLE_AUTH'];
        process.env['NODE_ENV'] = 'development';
        expect(isAuthDisabled()).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm --filter @bin-tracker/api test auth-flags` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// apps/api/src/lib/auth-flags.ts
/**
 * Central auth-bypass flag. DISABLE_AUTH=true is a dev/demo convenience
 * and is HARD-DISABLED in production regardless of env value.
 */
export function isAuthDisabled(): boolean {
    if (process.env['NODE_ENV'] === 'production') return false;
    return process.env['DISABLE_AUTH'] === 'true';
}
```

- [ ] **Step 4: Replace all 6 inline checks.** In `context.ts`, `trpc.ts`, `middleware.ts`, replace every `process.env['DISABLE_AUTH'] === 'true'` with `isAuthDisabled()` (import from `../lib/auth-flags.js` — path is `./lib/auth-flags.js` relative to `trpc/`... use `../lib/auth-flags.js`). Verify with: `grep -rn "DISABLE_AUTH" apps/api/src --include="*.ts"` → the only remaining hit must be inside `auth-flags.ts` itself.

- [ ] **Step 5: Run full API test suite + typecheck** — `pnpm --filter @bin-tracker/api test && pnpm --filter @bin-tracker/api typecheck` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "fix(auth): hard-disable DISABLE_AUTH bypass in production"`

### Task 2: Convert public routers to authenticated procedures

**Files:**
- Modify: `apps/api/src/routers/employee.router.ts`, `attendance.router.ts`, `shipment.router.ts`, `payroll.router.ts`, `farmer.router.ts`, `form.router.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `stationProcedure`, `opsManagerProcedure` from `../trpc/trpc.js` (already exist).
- Produces: no new symbols — same procedure names, stricter auth.

**Mapping (apply exactly):**

| Router | Procedure | New base |
|---|---|---|
| payroll | computeRun, getRun, listRuns | `opsManagerProcedure` |
| employee | register | `opsManagerProcedure` |
| employee | list, getById | `protectedProcedure` |
| attendance | scan | `stationProcedure` (guard kiosk is a station) |
| attendance | summary, recent | `protectedProcedure` |
| shipment | register, facilityOptions | `stationProcedure` |
| shipment | list, getById | `protectedProcedure` |
| farmer | transcribe, register | `stationProcedure` |
| form | listByStage, getById | `stationProcedure` (tablet fill flow) |
| form | digitizeFromPhoto, refineFromRegion, create | `opsManagerProcedure` |
| form | transcribeField | `stationProcedure` |
| form | adminList | keep `protectedProcedure` |

- [ ] **Step 1:** For each router file, change the import and procedure base per the table. Example for payroll:

```ts
// apps/api/src/routers/payroll.router.ts — imports become:
import { router, opsManagerProcedure } from '../trpc/trpc.js';
// and each `publicProcedure.` becomes `opsManagerProcedure.`
```

- [ ] **Step 2:** Verify no tenant-facing router still uses publicProcedure: `grep -rn "publicProcedure" apps/api/src/routers/` → expected: zero hits (after Phase 4 adds `auth.router.ts` signup, that one file is the only allowed exception).

- [ ] **Step 3:** Frontend impact check: the guard scanner (`apps/web/src/features/guard/GuardScannerPage.tsx`), tablet, shipments, and forms pages must now send auth headers. Find how the tRPC client attaches headers (`grep -rn "createTRPCClient\|httpBatchLink" apps/web/src`) and confirm station token / Supabase session is sent for those surfaces. If kiosk pages currently send nothing, add the station token header there (the pattern already exists for `TabletPage`).

- [ ] **Step 4:** Run: `pnpm typecheck && pnpm --filter @bin-tracker/api test` → PASS. Manually smoke-test dev: with `DISABLE_AUTH=true` locally everything still works (bypass is dev-only now).

- [ ] **Step 5: Commit** — `git commit -m "fix(auth): require station/user auth on employee, attendance, shipment, payroll, farmer, form routers"`

### Task 3: Make station tokens revocable

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (Station model), `apps/api/src/trpc/context.ts:65-70`
- Migration: `packages/db/prisma/migrations/<ts>_station_revocation/`

- [ ] **Step 1:** Add to `Station` model: `revokedAt DateTime?`. Run `pnpm db:migrate:dev --name station_revocation`.
- [ ] **Step 2:** In `context.ts`, station lookup adds the filter:

```ts
station = await prisma.station.findUnique({
    where: { token },
    include: { facility: { select: { id: true, name: true } } },
});
if (station?.revokedAt) station = null; // revoked tokens are dead tokens
```

- [ ] **Step 3:** Typecheck + test → PASS. Commit: `git commit -m "feat(auth): revocable station tokens"`

---

# Phase 2 — Organization (Tenant) Layer

**Design locked in:**
- New models: `Organization`, `OrganizationMember`, `Invitation` (used in Phase 4), `Subscription` (used in Phase 3 — created here so migrations happen once).
- `User.role` STAYS for now (single-org-per-user at launch; role-per-org is deferred — YAGNI). `OrganizationMember` carries membership only.
- Direct `organizationId` column added to: `Facility`, `BinType`, `Bin`, `BinCycle`, `Employee`, `Shipment`, `FormTemplate`, `AnimalRegistration`, `Settings`, `PayrollRun`. (`EventLog`, `WorkSession`, `AttendanceEvent`, `PayrollLineItem`, `PayrollException`, `Station`, `UserFacility` chain through a parent that has it — do not add columns there.)
- Uniqueness changes — ALL tenant-facing codes become per-org unique: `BinType.organType` → `@@unique([organizationId, organType])`; `BinType.masterQrCode` → `@@unique([organizationId, masterQrCode])`; `Bin.qrCode` → `@@unique([organizationId, qrCode])`; `Employee.employeeCode` and `Employee.qrCode` → `@@unique([organizationId, ...])`; `Shipment.shipmentCode` → `@@unique([organizationId, shipmentCode])`; `Settings.singleton` → replaced by `organizationId @unique`; `PayrollRun.period` → `@@unique([organizationId, period])`.
- **Why per-org, not global:** Task 9 provisions the SAME default master QR codes (e.g. `TYPE-HEART`) for every new org — global uniqueness would crash the second org's signup. And every scan arrives through a station or logged-in user whose org is already resolved, so lookups become compound-key `findUnique({ where: { organizationId_qrCode: { organizationId: orgId, qrCode } } })` — no ambiguity is possible.

### Task 4: Schema migration A — additive (nullable orgId everywhere)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Migration: `packages/db/prisma/migrations/<ts>_org_layer_additive/`

- [ ] **Step 1:** Add new models to schema.prisma:

```prisma
enum Plan {
  STARTER
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members      OrganizationMember[]
  invitations  Invitation[]
  subscription Subscription?

  @@map("organizations")
}

model OrganizationMember {
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  createdAt DateTime @default(now())

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([orgId, userId])
  @@index([userId])
  @@map("organization_members")
}

model Invitation {
  id        String    @id @default(cuid())
  orgId     String
  email     String
  role      UserRole
  token     String    @unique
  expiresAt DateTime
  acceptedAt DateTime?
  createdAt DateTime  @default(now())

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@map("invitations")
}

model Subscription {
  id                   String             @id @default(cuid())
  orgId                String             @unique
  stripeCustomerId     String?            @unique // null until first checkout — row exists from org provisioning
  stripeSubscriptionId String?            @unique
  plan                 Plan               @default(STARTER)
  status               SubscriptionStatus @default(TRIALING)
  currentPeriodEnd     DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}
```

- [ ] **Step 2:** Add `organizationId String?` + `@@index([organizationId])` to the 10 listed models, and `memberships OrganizationMember[]` back-relation on `User`. NULLABLE — no defaults, no constraint changes yet.
- [ ] **Step 3:** `pnpm db:migrate:dev --name org_layer_additive` → migration applies cleanly. `pnpm db:generate`.
- [ ] **Step 4:** `pnpm typecheck` (whole repo) → PASS (nullable columns break nothing).
- [ ] **Step 5: Commit** — `git commit -m "feat(db): additive Organization/Member/Invitation/Subscription models + nullable organizationId columns"`

### Task 5: Backfill script — default org for existing data

**Files:**
- Create: `packages/db/src/backfill-org.ts`
- Modify: `packages/db/package.json` (add script `"backfill:org": "tsx src/backfill-org.ts"`)

- [ ] **Step 1: Implement (idempotent — safe to re-run):**

```ts
// packages/db/src/backfill-org.ts
import { prisma } from './index.js';

const TENANT_TABLES = [
    'facilities', 'bin_types', 'bins', 'bin_cycles', 'employees',
    'shipments', 'form_templates', 'animal_registrations', 'settings', 'payroll_runs',
] as const;

async function main(): Promise<void> {
    const org = await prisma.organization.upsert({
        where: { slug: 'default' },
        update: {},
        create: { name: 'Default Organization', slug: 'default' },
    });

    // Legacy org keeps full access: explicit ENTERPRISE subscription row.
    // (requireModule denies orgs WITHOUT an enabled OrganizationModule row — see Task 14.)
    await prisma.subscription.upsert({
        where: { orgId: org.id },
        update: {},
        create: { orgId: org.id, plan: 'ENTERPRISE', status: 'ACTIVE' },
    });

    for (const table of TENANT_TABLES) {
        // Raw SQL: Prisma's typed API can't iterate table names.
        const updated = await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
            org.id,
        );
        console.log(`${table}: backfilled ${updated} rows`);
    }

    // Every existing user becomes a member of the default org.
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
        await prisma.organizationMember.upsert({
            where: { orgId_userId: { orgId: org.id, userId: u.id } },
            update: {},
            create: { orgId: org.id, userId: u.id },
        });
    }
    console.log(`memberships ensured for ${users.length} users`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2:** Run against local dev DB: `pnpm --filter @bin-tracker/db backfill:org` → all tables report backfilled counts; re-run → all report 0 (idempotent).
- [ ] **Step 3:** Verify: `SELECT COUNT(*) FROM facilities WHERE "organizationId" IS NULL;` → 0.
- [ ] **Step 4: Commit** — `git commit -m "feat(db): idempotent default-org backfill script"`

### Task 6: Schema migration B — enforce NOT NULL + tenant-scoped uniques

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Migration: `packages/db/prisma/migrations/<ts>_org_layer_enforce/`

- [ ] **Step 1:** In schema.prisma: change all 10 `organizationId String?` → `organizationId String`, add relations `organization Organization @relation(fields: [organizationId], references: [id])` and back-relations on `Organization`. Change uniques:
  - `BinType`: remove `@unique` from `organType` and `masterQrCode`, add `@@unique([organizationId, organType])` and `@@unique([organizationId, masterQrCode])`.
  - `Bin`: remove `@unique` from `qrCode`, add `@@unique([organizationId, qrCode])`.
  - `Employee`: remove `@unique` from `employeeCode` and `qrCode`, add `@@unique([organizationId, employeeCode])` and `@@unique([organizationId, qrCode])`.
  - `Shipment`: remove `@unique` from `shipmentCode`, add `@@unique([organizationId, shipmentCode])`.
  - `Settings`: delete the `singleton` field, add `@unique` on `organizationId`.
  - `PayrollRun`: remove `@unique` from `period`, add `@@unique([organizationId, period])`.
  - Lookup fallout (fix in Task 8): every `findUnique({ where: { qrCode } })` in `bin.service.ts`, `employee.service.ts`, `attendance.service.ts`, `shipment.service.ts` becomes the compound form `findUnique({ where: { organizationId_qrCode: { organizationId: orgId, qrCode } } })` (Prisma generates the compound-key name from the `@@unique` fields).
- [ ] **Step 2:** `pnpm db:migrate:dev --name org_layer_enforce`. **Before applying to prod:** the deploy workflow must run backfill between migration A and B (see Task 10 rollout).
- [ ] **Step 3:** Fix compile fallout NOW (Prisma client types changed): `pnpm typecheck` will fail everywhere a tenant record is `create`d without `organizationId` and in `payroll.service.ts` (references `singleton`). Fix each create-site by threading orgId (full wiring in Tasks 7–8; for this task, get typecheck green by updating the seed script `packages/db/src/seed*.ts` and service create calls to accept an `organizationId` param).
- [ ] **Step 4:** `pnpm typecheck && pnpm --filter @bin-tracker/api test` → PASS. Commit: `git commit -m "feat(db): enforce NOT NULL organizationId + per-org uniqueness"`

### Task 7: `orgProcedure` — resolve tenant in tRPC context

**Files:**
- Modify: `apps/api/src/trpc/context.ts`, `apps/api/src/trpc/trpc.ts`
- Test: `apps/api/src/trpc/org-context.test.ts`

**Interfaces:**
- Produces: `Context.orgId: string | null` (resolved in `createContext`); `orgProcedure` (user with membership), `orgAdminProcedure` (ADMIN + membership), `orgOpsProcedure` (ADMIN|OPS_MANAGER + membership), `stationOrgProcedure` (station; orgId via facility). Every downstream ctx has non-null `orgId`.

- [ ] **Step 1: Write failing tests** for the resolution logic (extract it as a pure-ish function so it's testable):

```ts
// apps/api/src/trpc/org-context.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveOrgId } from './org-context.js';

describe('resolveOrgId', () => {
    it('resolves org from user membership', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue({ orgId: 'org_1' }) },
            facility: { findUnique: vi.fn() },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1', facilityId: null })).toBe('org_1');
    });

    it('resolves org from station facility', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn() },
            facility: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org_2' }) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: null, facilityId: 'f1' })).toBe('org_2');
    });

    it('returns null when neither resolves', async () => {
        const prisma = {
            organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
            facility: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(await resolveOrgId(prisma as any, { userId: 'u1', facilityId: 'f1' })).toBe(null);
    });
});
```

- [ ] **Step 2:** Run → FAIL (module not found). Implement:

```ts
// apps/api/src/trpc/org-context.ts
import type { PrismaClient } from '@prisma/client';

interface OrgResolutionInput {
    userId: string | null;
    facilityId: string | null; // from station.facility.id
}

/** Resolve the tenant for this request: user membership wins, then station's facility. */
export async function resolveOrgId(
    prisma: PrismaClient,
    { userId, facilityId }: OrgResolutionInput,
): Promise<string | null> {
    if (userId) {
        const member = await prisma.organizationMember.findFirst({
            where: { userId },
            select: { orgId: true },
            orderBy: { createdAt: 'asc' }, // deterministic if a user ever has 2 memberships
        });
        if (member) return member.orgId;
    }
    if (facilityId) {
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { organizationId: true },
        });
        if (facility) return facility.organizationId;
    }
    return null;
}
```

- [ ] **Step 3:** In `context.ts`: add `orgId: string | null` to the `Context` interface; at the end of `createContext`, compute `const orgId = await resolveOrgId(prisma, { userId: user?.id ?? null, facilityId: station?.facility.id ?? null });` and return it. In the `isAuthDisabled()` branch, resolve it the same way from the injected user/station.
- [ ] **Step 4:** In `trpc.ts`, add:

```ts
const hasOrg = middleware(async ({ ctx, next }) => {
    if (!ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization for this account' });
    }
    return next({ ctx: { ...ctx, orgId: ctx.orgId } });
});

export const orgProcedure = protectedProcedure.use(hasOrg);
export const orgAdminProcedure = t.procedure.use(requireRole('ADMIN')).use(hasOrg);
export const orgOpsProcedure = t.procedure.use(requireRole('ADMIN', 'OPS_MANAGER')).use(hasOrg);
export const stationOrgProcedure = stationProcedure.use(hasOrg);
```

- [ ] **Step 5:** Tests + typecheck → PASS. Commit: `git commit -m "feat(tenancy): org resolution in context + org-scoped procedures"`

### Task 8: Org-scope every service query (the big one — do router by router)

**Files:**
- Modify: all 12 service files in `apps/api/src/services/`, all 11 routers in `apps/api/src/routers/`
- Test: extend `apps/api/src/services/attendance.service.test.ts` pattern per touched service

**The pattern (apply uniformly).** Every service method gains a first param `orgId: string`; every router passes `ctx.orgId`. Example — payroll:

```ts
// payroll.router.ts (after Task 2 it uses opsManagerProcedure → now orgOpsProcedure)
computeRun: orgOpsProcedure
    .input(payrollPeriodSchema)
    .mutation(async ({ ctx, input }) => payrollService.computeRun(ctx.orgId, input)),
```

```ts
// payroll.service.ts — every query gains the org filter:
const settings = await prisma.settings.findUnique({ where: { organizationId: orgId } });
const run = await prisma.payrollRun.findUnique({
    where: { organizationId_period: { organizationId: orgId, period } },
});
// raw SQL for sessions gains: AND e."organizationId" = ${orgId} (join employees)
```

**Checklist of scoping rules per router (each is a sub-commit):**

- [ ] `bin` — `bin.service.ts`: all `bin`/`binType` queries filter `organizationId: orgId`; `start`/`startDynamic` create with `organizationId: orgId`. Routers: `stationProcedure` → `stationOrgProcedure`.
- [ ] `cycle` — `cycle.service.ts`: `binCycle` queries filter org; `pickup`/`deliver` verify the cycle's `organizationId === orgId` inside the Serializable transaction (throw `NOT_FOUND`, not `FORBIDDEN` — don't leak existence).
- [ ] `facility` — filter + create with org; `assignedDriverProcedure`-based routes chain through cycle org check.
- [ ] `dashboard` — `getUserFacilityIds` in `middleware.ts` gains `orgId` param: the ADMIN branch becomes `where: { deletedAt: null, organizationId: orgId }`.
- [ ] `blockchain` — `getDailySummary`/`confirmAnchor` filter cycles by org. **Canonical-leaf format is unchanged** (the `canonicalize()` comment says never change it — orgId is a filter, not a leaf field).
- [ ] `employee`, `attendance` — employee queries filter org; `WorkSession`/`AttendanceEvent` scope via `employee: { organizationId: orgId }` relation filter.
- [ ] `shipment`, `farmer` (AnimalRegistration), `form` (FormTemplate) — direct org filter + create with org.
- [ ] `payroll` — as shown above, including the raw-SQL period-bounds query (join employees for the org filter).

- [ ] **Verification step (mandatory):** run this audit and manually justify every hit:

```bash
grep -rn "prisma\.\(facility\|binType\|bin\|binCycle\|employee\|shipment\|formTemplate\|animalRegistration\|settings\|payrollRun\)\." apps/api/src/services/ | grep -v organizationId
```

Target: zero unexplained hits. Add this grep as `apps/api/scripts/tenancy-audit.sh` and wire it into CI (`.github/workflows/` CI job) so a future unscoped query fails the build.

- [ ] **Isolation test (mandatory):** one integration-style test that seeds two orgs and proves cross-tenant reads return nothing:

```ts
// apps/api/src/services/tenancy-isolation.test.ts
// Follow attendance.service.test.ts mocking style OR run against local test DB.
// Assert: employeeService.list(orgA) never contains an employee created under orgB,
// and payrollService.getRun(orgA, '2026-07') is null when the run belongs to orgB.
```

- [ ] Typecheck + full test suite green after EACH router conversion; commit each: `git commit -m "feat(tenancy): org-scope <router> router/service"`

### Task 9: Seed + provisioning defaults per org

**Files:**
- Modify: `packages/db/src/seed.ts` (and `seed-local` variant)
- Create: `apps/api/src/services/org-provision.service.ts`

**Interfaces:**
- Produces: `provisionOrganization(prisma, { name, slug, ownerUserId }): Promise<{ orgId: string }>` — creates org + membership + default `BinType` set (Heart 4h CRITICAL, Liver 6h CRITICAL, Kidneys 12h MEDIUM, Skin 24h STANDARD, Fat 24h STANDARD, Bones 48h LOW — same data currently in the seed) + default `Settings` row + a `Subscription` row (`plan: 'STARTER'`, `status: 'TRIALING'`, `stripeCustomerId: null` until first checkout). Used by seed AND by Phase 4 signup. Task 12 extends this same function to also seed default `OrganizationModule` rows for the STARTER bundle — Task 14's `requireModule` DENIES any org without an enabled row for the module being accessed, so both the `Subscription` row and the module rows are mandatory here.

- [ ] **Step 1:** Extract the bin-type defaults from the current seed into `org-provision.service.ts` as `DEFAULT_BIN_TYPES` const; implement `provisionOrganization` as one `prisma.$transaction`.
- [ ] **Step 2:** Seed script calls `provisionOrganization` for the demo org, then seeds facilities/bins under it. `SEED_ONLY_IF_EMPTY=true` behavior preserved (checked before provisioning).
- [ ] **Step 3:** `pnpm db:migrate:reset` locally → seed runs green. Commit: `git commit -m "feat(tenancy): per-org provisioning service + org-aware seed"`

### Task 10: Production rollout of Phase 2 (runbook — execute, don't skip)

- [ ] 1. Deploy code that ships migration A only (Task 4). Migration runs via existing deploy workflow → prod has nullable columns, app ignores them.
- [ ] 2. Run backfill against prod (one-off job): `pnpm --filter @bin-tracker/db backfill:org` with prod `DATABASE_URL` from the GitHub Environment (use the existing gated "Deploy Production" workflow pattern — add a `workflow_dispatch` job for it; never run from a laptop).
- [ ] 3. Verify in Supabase SQL editor: `SELECT COUNT(*) FROM facilities WHERE "organizationId" IS NULL;` → 0 (repeat for all 10 tables).
- [ ] 4. Deploy code with migration B + all org-scoped services (Tasks 6–9) as ONE release.
- [ ] 5. Smoke-test prod: tablet scan → bin start; dashboard loads; payroll `listRuns` returns data.
- [ ] 6. Rollback plan: migration B is the risk point. If it fails at `NOT NULL`, the backfill missed rows — fix rows, re-run migrate. On the VPS (see `kvmplan.md`), rollback is "flip Caddy's upstream back to the previous blue/green color" — keep that color's container untouched and running until the new one is verified, so revert is instant with no redeploy needed.

---

# Phase 3 — Modular Entitlements + Stripe Billing

**Design change from the original flat plan-tier approach:** rather than three fixed plans each hard-wired to a fixed feature set, the product's optional feature areas — Animal Registration, Workforce (employee/timesheet/guard), Shipments, Forms, AI Form Digitization, Blockchain Anchoring, Payroll — become **modules**. Plans (STARTER/PRO/ENTERPRISE) grant a *default module bundle* at signup/upgrade, but a platform admin (you, the SaaS operator) can enable or disable any individual module for any org regardless of its plan tier. This is what makes "assign each client exactly what they need" real, and it matches how bin-tracker is actually likely to be sold — B2B, sales-assisted, custom per-facility needs — rather than pure self-serve.

Bin scanning, cycle pickup/deliver, facility management, and the dashboard are **not** a module — every org gets them unconditionally. They're the state machine (`IDLE → ACTIVE → IN_TRANSIT → COMPLETED`) the entire product is built on, not an optional add-on.

### Task 11: Module registry + plan limits (shared package)

**Files:**
- Create: `packages/types/src/entitlements.ts`
- Modify: `packages/types/src/index.ts` (export it)
- Test: `packages/validators/tests/entitlements.test.ts`

**Interfaces:**
- Produces: `ModuleKey` (7 values), `Plan`, `SubscriptionStatus`, `PLAN_LIMITS: Record<Plan, PlanLimits>`, `PLAN_DEFAULT_MODULES: Record<Plan, ModuleKey[]>`, `defaultModulesForPlan(plan): ModuleKey[]`, `isSubscriptionUsable(status): boolean`. Consumed by Task 12 (provisioning/reconciliation), Task 14 (`requireModule` middleware), Task 17 (frontend nav).

- [ ] **Step 1: Failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { PLAN_DEFAULT_MODULES, PLAN_LIMITS, defaultModulesForPlan, isSubscriptionUsable } from '@bin-tracker/types';

describe('entitlements', () => {
    it('STARTER does not default-include blockchain or payroll', () => {
        expect(defaultModulesForPlan('STARTER')).not.toContain('BLOCKCHAIN_ANCHOR');
        expect(defaultModulesForPlan('STARTER')).not.toContain('PAYROLL');
    });
    it('PRO default-includes payroll and blockchain but not AI digitize', () => {
        const modules = defaultModulesForPlan('PRO');
        expect(modules).toContain('PAYROLL');
        expect(modules).toContain('BLOCKCHAIN_ANCHOR');
        expect(modules).not.toContain('FORMS_AI_DIGITIZE');
    });
    it('ENTERPRISE includes every module', () => {
        expect(defaultModulesForPlan('ENTERPRISE')).toContain('FORMS_AI_DIGITIZE');
    });
    it('TRIALING and ACTIVE are usable statuses; PAST_DUE and CANCELED are not', () => {
        expect(isSubscriptionUsable('TRIALING')).toBe(true);
        expect(isSubscriptionUsable('ACTIVE')).toBe(true);
        expect(isSubscriptionUsable('PAST_DUE')).toBe(false);
        expect(isSubscriptionUsable('CANCELED')).toBe(false);
    });
    it('every plan defines every limit key', () => {
        const keys = Object.keys(PLAN_LIMITS.STARTER);
        expect(Object.keys(PLAN_LIMITS.PRO)).toEqual(keys);
        expect(Object.keys(PLAN_LIMITS.ENTERPRISE)).toEqual(keys);
    });
});
```

- [ ] **Step 2:** Implement:

```ts
// packages/types/src/entitlements.ts
export type Plan = 'STARTER' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

/**
 * One module per optional feature area. CORE_TRACKING (bin/cycle/facility/
 * dashboard) is deliberately absent — it's not gateable, every org has it.
 */
export type ModuleKey =
    | 'ANIMAL_INTAKE'      // farmer/voice registration — farmer.router
    | 'WORKFORCE'          // employee register + timesheet + guard scanner — employee/attendance routers
    | 'SHIPMENTS'          // register + record shipments — shipment.router
    | 'FORMS'              // create + fill forms — form.router, excluding AI digitize
    | 'FORMS_AI_DIGITIZE'  // Gemini photo-to-form digitization — metered, Task 15
    | 'BLOCKCHAIN_ANCHOR'  // Cardano CIP-25 anchoring — blockchain.router
    | 'PAYROLL';           // requires WORKFORCE — payroll.router

export interface PlanLimits {
    maxFacilities: number;    // -1 = unlimited
    maxEmployees: number;
    monthlyDigitize: number;  // -1 = unlimited, 0 = not available on this plan
    monthlyTranscribe: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
    STARTER:    { maxFacilities: 1,  maxEmployees: 25,  monthlyDigitize: 0,  monthlyTranscribe: 0 },
    PRO:        { maxFacilities: 5,  maxEmployees: 200, monthlyDigitize: 20, monthlyTranscribe: 50 },
    ENTERPRISE: { maxFacilities: -1, maxEmployees: -1,  monthlyDigitize: -1, monthlyTranscribe: -1 },
};

/** Default module bundle granted when an org signs up for or upgrades to a plan. */
export const PLAN_DEFAULT_MODULES: Record<Plan, ModuleKey[]> = {
    STARTER:    ['WORKFORCE', 'SHIPMENTS'],
    PRO:        ['ANIMAL_INTAKE', 'WORKFORCE', 'SHIPMENTS', 'FORMS', 'BLOCKCHAIN_ANCHOR', 'PAYROLL'],
    ENTERPRISE: ['ANIMAL_INTAKE', 'WORKFORCE', 'SHIPMENTS', 'FORMS', 'FORMS_AI_DIGITIZE', 'BLOCKCHAIN_ANCHOR', 'PAYROLL'],
};

const USABLE_STATUSES: readonly SubscriptionStatus[] = ['TRIALING', 'ACTIVE'];

/** What a FRESH signup/upgrade should default to. NOT the enforcement source of truth — see Task 12/14's OrganizationModule table for that. */
export function defaultModulesForPlan(plan: Plan): ModuleKey[] {
    return PLAN_DEFAULT_MODULES[plan];
}

export function isSubscriptionUsable(status: SubscriptionStatus): boolean {
    return USABLE_STATUSES.includes(status);
}
```

- [ ] **Step 3:** Test green. Commit: `git commit -m "feat(billing): module registry and plan limits"`

### Task 12: `OrganizationModule` schema — the actual per-client assignment mechanism

**Files:**
- Modify: `packages/db/prisma/schema.prisma`, `apps/api/src/services/org-provision.service.ts` (Phase 2 Task 9)
- Create: `apps/api/src/services/module.service.ts`
- Migration: `packages/db/prisma/migrations/<ts>_organization_modules/`
- Test: `apps/api/src/services/module.service.test.ts`

**Interfaces:**
- Produces: `reconcileModulesForPlan(prisma, orgId, plan): Promise<void>`, `getEnabledModules(prisma, orgId): Promise<ModuleKey[]>`, `setModuleOverride(prisma, { orgId, module, enabled, updatedBy }): Promise<void>`. Consumed by Task 9's provisioning, Task 13's Stripe webhook handler, Task 14's `requireModule` middleware, Task 16's admin router.

The key design element is the `source` column: rows created automatically from a plan default are `source: 'plan'` and get reconciled (added/removed) whenever the org's subscription plan changes. Rows a platform admin manually toggles are `source: 'manual'` and are **never** touched by plan-change reconciliation — this is the exact mechanism that lets you give one STARTER client Payroll as a custom add-on without upgrading their whole plan, or hide a module a PRO client explicitly doesn't want cluttering their nav.

- [ ] **Step 1:** Schema:

```prisma
enum ModuleKey {
  ANIMAL_INTAKE
  WORKFORCE
  SHIPMENTS
  FORMS
  FORMS_AI_DIGITIZE
  BLOCKCHAIN_ANCHOR
  PAYROLL
}

model OrganizationModule {
  id        String    @id @default(cuid())
  orgId     String
  module    ModuleKey
  enabled   Boolean   @default(true)
  source    String    @default("plan") // 'plan' | 'manual' — manual survives plan changes
  updatedAt DateTime  @updatedAt
  updatedBy String?   // platform admin's user id, set only when source = 'manual'

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, module])
  @@index([orgId])
  @@map("organization_modules")
}
```

`pnpm db:migrate:dev --name organization_modules`.

- [ ] **Step 2: Failing tests for `module.service.ts`:**

```ts
// apps/api/src/services/module.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { reconcileModulesForPlan, getEnabledModules, setModuleOverride } from './module.service.js';

describe('reconcileModulesForPlan', () => {
    it('adds plan-sourced modules missing for the new plan', async () => {
        const upserts: unknown[] = [];
        const prisma = {
            organizationModule: {
                findMany: vi.fn().mockResolvedValue([]),
                upsert: vi.fn().mockImplementation((args) => { upserts.push(args); return Promise.resolve(); }),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        await reconcileModulesForPlan(prisma, 'org_1', 'PRO');
        expect(upserts.length).toBe(6); // PRO's default bundle size
    });

    it('does not touch manually-overridden rows when downgrading', async () => {
        const prisma = {
            organizationModule: {
                findMany: vi.fn().mockResolvedValue([
                    { module: 'PAYROLL', source: 'manual', enabled: true },
                ]),
                upsert: vi.fn(),
                updateMany: vi.fn(),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        await reconcileModulesForPlan(prisma, 'org_1', 'STARTER');
        // updateMany (which disables stale plan-sourced modules) must exclude source: 'manual'
        expect(prisma.organizationModule.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ source: 'plan' }) }),
        );
    });
});
```

- [ ] **Step 3:** Run → FAIL (module not found). Implement:

```ts
// apps/api/src/services/module.service.ts
import type { PrismaClient, ModuleKey } from '@prisma/client';
import { PLAN_DEFAULT_MODULES, type Plan } from '@bin-tracker/types';

export async function reconcileModulesForPlan(prisma: PrismaClient, orgId: string, plan: Plan): Promise<void> {
    const defaults = PLAN_DEFAULT_MODULES[plan];
    for (const module of defaults) {
        await prisma.organizationModule.upsert({
            where: { orgId_module: { orgId, module: module as ModuleKey } },
            update: { enabled: true, source: 'plan' },
            create: { orgId, module: module as ModuleKey, enabled: true, source: 'plan' },
        });
    }
    // Plan-sourced modules NOT in the new plan's defaults get disabled — manual overrides are untouched.
    await prisma.organizationModule.updateMany({
        where: { orgId, source: 'plan', module: { notIn: defaults as ModuleKey[] } },
        data: { enabled: false },
    });
}

export async function getEnabledModules(prisma: PrismaClient, orgId: string): Promise<ModuleKey[]> {
    const rows = await prisma.organizationModule.findMany({ where: { orgId, enabled: true } });
    return rows.map((r) => r.module);
}

export async function setModuleOverride(
    prisma: PrismaClient,
    input: { orgId: string; module: ModuleKey; enabled: boolean; updatedBy: string },
): Promise<void> {
    await prisma.organizationModule.upsert({
        where: { orgId_module: { orgId: input.orgId, module: input.module } },
        update: { enabled: input.enabled, source: 'manual', updatedBy: input.updatedBy },
        create: { orgId: input.orgId, module: input.module, enabled: input.enabled, source: 'manual', updatedBy: input.updatedBy },
    });
}
```

- [ ] **Step 4:** Extend `provisionOrganization` (Phase 2 Task 9) to call `reconcileModulesForPlan(prisma, orgId, defaultPlanForNewOrg())` as part of its provisioning transaction — every new org gets its default module rows at creation, the same way it gets its default `Subscription` row. `defaultPlanForNewOrg()` lives in `billing.service.ts` (Task 13) and reads the `BILLING_ENABLED` kill-switch:

```ts
// apps/api/src/services/billing.service.ts
export function defaultPlanForNewOrg(): Plan {
    // Free launch period: every new org gets the full module bundle at no charge.
    // Flip BILLING_ENABLED=true once you're ready to actually charge — new
    // signups will then default to STARTER and go through real Stripe checkout.
    return process.env['BILLING_ENABLED'] === 'true' ? 'STARTER' : 'ENTERPRISE';
}
```

This is the entire mechanism for "off now, on later": nothing about `requireModule`, the `OrganizationModule` table, or module gating changes — a free-period org simply gets provisioned with the ENTERPRISE bundle (full access, all modules) and an `ACTIVE` subscription with no Stripe customer attached. The kill-switch controls only what a *new* org defaults to at signup, so it needs zero rework later — you're toggling one env var, not re-architecting.
- [ ] **Step 5:** Tests + typecheck green. Commit: `git commit -m "feat(billing): OrganizationModule table with plan-sourced defaults and manual overrides"`

### Task 13: Stripe integration — checkout + webhook sync

**Files:**
- Create: `apps/api/src/lib/stripe.ts`, `apps/api/src/routes/stripe-webhook.ts`, `apps/api/src/services/billing.service.ts`, `apps/api/src/routers/billing.router.ts`
- Modify: `apps/api/src/server.ts` (register webhook route BEFORE tRPC, with raw body), `apps/api/src/routers/index.ts`, `.env.example`
- Test: `apps/api/src/services/billing.service.test.ts`

**Interfaces:**
- Produces: tRPC `billing.createCheckoutSession({ plan }) → { url }` (orgAdminProcedure), `billing.createPortalSession() → { url }`, `billing.current() → { plan, status, currentPeriodEnd }` (orgProcedure), `billing.status() → { enabled: boolean }` (publicProcedure — reads `BILLING_ENABLED`, consumed by frontend Task 17 to hide billing UI during the free period); Fastify route `POST /webhooks/stripe`.
- Env: `BILLING_ENABLED` (`'true'`/`'false'`, **defaults to `'false'`** — the whole Stripe integration ships built but inert until this flips), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `APP_URL`.

**Free-launch note:** `createCheckoutSession`/`createPortalSession` should still be fully implemented and tested in this task — you're building real Stripe integration, just not exposing it yet. Both throw `TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Billing is not yet enabled' })` when `BILLING_ENABLED !== 'true'`, as a server-side backstop; the frontend (Task 17) is expected to never call them while `billing.status().enabled` is `false`, so this should only ever trigger from a stale client. `STRIPE_SECRET_KEY` can stay unset/blank during the free period — `lib/stripe.ts`'s fail-fast check only needs to run when a checkout/portal call is actually attempted, not at server boot, so an empty key doesn't crash the app.

- [ ] **Step 1:** `pnpm --filter @bin-tracker/api add stripe`. Add env vars to `.env.example` with placeholders.
- [ ] **Step 2:** `lib/stripe.ts` — lazy singleton, so an unset `STRIPE_SECRET_KEY` during the free period doesn't crash the app at boot; it only fails when a checkout/portal call is actually attempted:

```ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (_stripe) return _stripe;
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured — set it before enabling BILLING_ENABLED');
    _stripe = new Stripe(key);
    return _stripe;
}

export const PRICE_BY_PLAN: Record<string, string> = {
    STARTER: process.env['STRIPE_PRICE_STARTER'] ?? '',
    PRO: process.env['STRIPE_PRICE_PRO'] ?? '',
    ENTERPRISE: process.env['STRIPE_PRICE_ENTERPRISE'] ?? '',
};
export const PLAN_BY_PRICE: Record<string, 'STARTER' | 'PRO' | 'ENTERPRISE'> =
    Object.fromEntries(Object.entries(PRICE_BY_PLAN).map(([p, id]) => [id, p])) as never;
```

- [ ] **Step 3:** `billing.service.ts` — write failing tests first for `syncSubscriptionFromStripe(orgId, stripeSub)` (pure mapping: stripe status `trialing|active|past_due|canceled|unpaid` → local enum; price id → plan; upsert by `orgId`; **then calls `reconcileModulesForPlan(prisma, orgId, plan)` from Task 12** so a plan change immediately updates the org's module bundle). Then implement. Key rule: **the webhook only trusts `subscription.items.data[0].price.id` and `subscription.status`** — never client input.
- [ ] **Step 4:** Webhook route — MUST use raw body for signature verification:

```ts
// apps/api/src/routes/stripe-webhook.ts
import type { FastifyInstance } from 'fastify';
import { getStripe } from '../lib/stripe.js';
import { billingService } from '../services/billing.service.js';

export async function registerStripeWebhook(server: FastifyInstance): Promise<void> {
    server.route({
        method: 'POST',
        url: '/webhooks/stripe',
        config: { rawBody: true },
        handler: async (req, reply) => {
            const sig = req.headers['stripe-signature'];
            const secret = process.env['STRIPE_WEBHOOK_SECRET'];
            if (!sig || !secret) return reply.status(400).send();
            let event;
            try {
                event = getStripe().webhooks.constructEvent(req.rawBody as string, sig, secret);
            } catch {
                return reply.status(400).send({ error: 'invalid signature' });
            }
            switch (event.type) {
                case 'checkout.session.completed':
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    await billingService.handleStripeEvent(event);
                    break;
                default:
                    break; // ignore unhandled events
            }
            return reply.status(200).send({ received: true });
        },
    });
}
```

Requires `fastify-raw-body`: `pnpm --filter @bin-tracker/api add fastify-raw-body`, register in `server.ts` with `{ field: 'rawBody', global: false, runFirst: true }`. The org↔customer link: `createCheckoutSession` sets `metadata: { orgId }` on the Checkout Session AND `subscription_data.metadata.orgId`; `handleStripeEvent` reads `orgId` from subscription metadata. **Event-shape gotcha:** `checkout.session.completed` carries a Session (with `session.subscription` as an ID string), not a Subscription object — for that event type, `handleStripeEvent` must first `await getStripe().subscriptions.retrieve(session.subscription as string)` before calling `syncSubscriptionFromStripe`. The `customer.subscription.*` events carry the Subscription object directly.
- [ ] **Step 5:** Local verification: `stripe listen --forward-to localhost:3001/webhooks/stripe`, run a test-mode checkout, confirm `subscriptions` row updates. Tests + typecheck green.
- [ ] **Step 6: Commit** — `git commit -m "feat(billing): stripe checkout, customer portal, webhook subscription sync"`

### Task 14: `requireModule` middleware — gate every optional router by module

**Files:**
- Modify: `apps/api/src/trpc/trpc.ts`, `apps/api/src/routers/blockchain.router.ts`, `payroll.router.ts`, `form.router.ts`, `farmer.router.ts`, `employee.router.ts`, `attendance.router.ts`, `shipment.router.ts`
- Test: `apps/api/src/trpc/require-module.test.ts`

This replaces the flat plan-tier `requireFeature` with a per-module check against the `OrganizationModule` table from Task 12 — the enforcement now reflects the org's actual assigned modules, not just its plan tier, so a manually-granted module (Task 16) is honored exactly like a plan-default one.

- [ ] **Step 1: Failing test:** mock `ctx.prisma.organizationModule.findUnique` returning `null` → FORBIDDEN; returning `{ enabled: false }` → FORBIDDEN; returning `{ enabled: true }` → passes through to `next()`.
- [ ] **Step 2: Implement in `trpc.ts`:**

```ts
import type { ModuleKey } from '@bin-tracker/types';

export function requireModule(module: ModuleKey) {
    return middleware(async ({ ctx, next }) => {
        if (!ctx.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization' });
        const row = await ctx.prisma.organizationModule.findUnique({
            where: { orgId_module: { orgId: ctx.orgId, module } },
        });
        // No row = never provisioned for this org (shouldn't happen after Task 12's
        // provisioning/backfill) → deny, never default to enabled.
        if (!row?.enabled) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `This feature (${module}) is not enabled for your organization. Contact your account manager to enable it.`,
            });
        }
        return next({ ctx });
    });
}
```

- [ ] **Step 3:** Apply per the module map: `blockchain.*` → `.use(requireModule('BLOCKCHAIN_ANCHOR'))`; `payroll.*` → `'PAYROLL'`; `form.digitizeFromPhoto`/`refineFromRegion` → `'FORMS_AI_DIGITIZE'`; `form.create`/`listByStage`/`getById`/`transcribeField` → `'FORMS'`; `farmer.*` → `'ANIMAL_INTAKE'`; `employee.*` and `attendance.*` → `'WORKFORCE'`; `shipment.*` → `'SHIPMENTS'`. Quantity limits: in `facility.create` enforce `PLAN_LIMITS[plan].maxFacilities`, in `employee.register` enforce `maxEmployees` (count current, compare, `-1` = skip) — these stay plan-based since they're capacity limits, not on/off features.
- [ ] **Step 4:** Tests + typecheck. Commit: `git commit -m "feat(billing): module-based gating on all optional routers"`

### Task 15: AI usage metering (protect your Gemini/AssemblyAI/Claude spend)

**Files:**
- Create: `apps/api/src/services/usage.service.ts`; schema: `UsageCounter` model
- Modify: `form-digitize.service.ts`, `farmer.service.ts` call-sites

- [ ] **Step 1:** Schema (+ migration `usage_counters`):

```prisma
model UsageCounter {
  id        String   @id @default(cuid())
  orgId     String
  metric    String   // 'form_digitize' | 'voice_transcribe'
  period    String   // 'YYYY-MM'
  count     Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([orgId, metric, period])
  @@map("usage_counters")
}
```

- [ ] **Step 2:** `usage.service.ts`: `checkAndIncrement(orgId, metric, limit)` — atomic upsert-with-increment inside a transaction; throws `TRPCError TOO_MANY_REQUESTS` when `count >= limit`. Limits come from `PLAN_LIMITS[plan].monthlyDigitize`/`.monthlyTranscribe` (Task 11) — this runs as a second check AFTER `requireModule('FORMS_AI_DIGITIZE')`/`'ANIMAL_INTAKE'` passes (module gate = can you use it at all; usage metering = how much this month).
- [ ] **Step 3:** Call it at the top of `digitizeFromPhoto`, `refineFromRegion`, `transcribe`, `transcribeField` service methods. Test: counter increments; limit blocks. Commit: `git commit -m "feat(billing): monthly AI usage metering per org"`

### Task 16: Internal platform-admin module toggle UI (the actual "assign per client" tool)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add `isPlatformAdmin Boolean @default(false)` to `User`), `apps/api/src/trpc/trpc.ts`
- Create: `apps/api/src/routers/admin.router.ts`, `apps/api/src/services/admin.service.ts`, `apps/web/src/features/admin/OrgModulesPage.tsx`
- Migration: `packages/db/prisma/migrations/<ts>_platform_admin_flag/`
- Test: `apps/api/src/routers/admin.router.test.ts`

**Why a separate flag, not the existing `ADMIN` role:** once Phase 2 lands, a `User`'s `ADMIN` role is scoped to *their* organization (`getUserFacilityIds` filters by `orgId`) — an org's admin should never be able to see or modify another org's modules. `isPlatformAdmin` is an orthogonal, org-independent flag for you as the SaaS operator only. Set it manually via `psql`/Prisma Studio for your own account — there is deliberately no self-serve way to grant it.

**Interfaces:**
- Produces: tRPC `admin.listOrganizations() → { id, name, plan, status, modules: { module, enabled, source }[] }[]` and `admin.toggleModule({ orgId, module, enabled }) → void` (both `platformAdminProcedure`).

- [ ] **Step 1:** Migration adding the column. `pnpm db:migrate:dev --name platform_admin_flag`.
- [ ] **Step 2: Failing test:** a `protectedProcedure` call from a user with `isPlatformAdmin: false` → FORBIDDEN; from `isPlatformAdmin: true` → passes.
- [ ] **Step 3:** In `trpc.ts`:

```ts
const isPlatformAdmin = middleware(async ({ ctx, next }) => {
    if (!ctx.user?.isPlatformAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform admin access required' });
    }
    return next({ ctx });
});
export const platformAdminProcedure = protectedProcedure.use(isPlatformAdmin);
```

- [ ] **Step 4:** `admin.service.ts` — `listOrganizations` joins `Organization` + `Subscription` + `OrganizationModule`; `toggleModule` calls `setModuleOverride` from Task 12 with `updatedBy: ctx.user.id` (always `source: 'manual'` — this is precisely the override path that survives future plan changes).
- [ ] **Step 5:** Test: a non-platform-admin call is rejected; toggling a module for org A does not create or modify any row for org B (tenancy isolation holds even for platform-admin actions, since every write is scoped to the `orgId` in the input).
- [ ] **Step 6:** `OrgModulesPage.tsx` — a simple table, one row per org (name, plan, status), one checkbox column per `ModuleKey`, calling `toggleModule` on change with an optimistic update + rollback on error (per the `patterns.md` optimistic-update convention). Route `/admin/orgs`, guarded by checking `auth.me().isPlatformAdmin` client-side (defense-in-depth only — the real enforcement is server-side in Step 3).
- [ ] **Step 7:** Commit: `git commit -m "feat(admin): platform-admin panel for per-org module assignment"`

### Task 17: Frontend — module-aware nav + billing settings

**Files:**
- Create: `apps/web/src/context/SubscriptionContext.tsx`, `apps/web/src/components/UpgradePrompt.tsx`
- Modify: the app shell's nav/sidebar component, and pages that deep-link into a gated module (payroll, blockchain modal, form import, farmer registration, employee/timesheet/guard pages, shipments)

- [ ] **Step 1:** `SubscriptionContext` fetches `billing.status` (`{ enabled }`), `billing.current` (plan/status), and a new `billing.enabledModules() → ModuleKey[]` query (add this procedure to `billing.router.ts`, backed by `getEnabledModules` from Task 12) once per session, exposes `hasModule(key: ModuleKey): boolean` and `billingEnabled: boolean` — single source of truth, no duplicated logic on the client.
- [ ] **Step 2:** App shell nav filters by `hasModule`: Animal Registration, Employees/Timesheet/Guard, Shipments, Forms, Blockchain, Payroll links only render if their module is enabled — an org that's never had a module doesn't see clutter for a feature it can't use. Bin/Dashboard/Facility/Driver links always render (not gateable, per the design note at the top of this phase). This step is unaffected by `billingEnabled` — module gating and billing are independent even during the free period (you can still keep an expensive module like `FORMS_AI_DIGITIZE` off by default for cost control without needing Stripe at all).
- [ ] **Step 3:** For deep-links to a disabled-but-plan-eligible module, render `<UpgradePrompt module="PAYROLL" />` — since module assignment is sales-assisted (Task 16), the copy is "Ask your account manager to enable this" rather than a self-serve button. When `billingEnabled` is `false`, skip rendering any "Upgrade my plan" self-serve button entirely (there's nothing to upgrade to yet) — show a simple "Free during early access" badge instead. Once `billingEnabled` flips to `true`, the same component starts rendering the self-serve STARTER→PRO→ENTERPRISE upgrade flow via `billing.createCheckoutSession`, with no other code change needed.
- [ ] **Step 4:** Billing settings page: if `!billingEnabled`, show "You're on full access during our free early-access period — pricing coming soon" and hide the plan/renewal/portal UI entirely; if `billingEnabled`, show current plan, renewal date, enabled-modules summary (read-only for the customer — toggling is Task 16's admin-only tool), "Manage billing" button → `createPortalSession` redirect.
- [ ] **Step 5:** Manual E2E: with `BILLING_ENABLED=false`, a new signup lands on ENTERPRISE/full access with no billing UI shown anywhere; an org with `WORKFORCE`+`SHIPMENTS` only (because a platform admin manually restricted it, independent of billing) only sees those two nav items plus core tracking; the admin toggles `PAYROLL` on for that org via `/admin/orgs` and it appears on next load with no redeploy. Commit: `git commit -m "feat(billing): module-aware nav, upgrade prompts, billing settings, free-period kill-switch"`

---

# Phase 4 — Signup, Onboarding, Invites

### Task 18: Self-serve signup → org creation

**Files:**
- Create: `apps/api/src/routers/auth.router.ts` (the one allowed `publicProcedure` router), `apps/web/src/features/onboarding/SignupPage.tsx`, `OnboardingWizard.tsx`
- Modify: `apps/api/src/routers/index.ts`, web router in `apps/web/src/pages`

- [ ] **Step 1:** Flow: Supabase Auth handles email/password signup client-side → first authenticated call is `auth.bootstrap` (`protectedProcedure`, NOT org-scoped): if the user has no `User` row, create one (`role: 'ADMIN'`, id = Supabase sub, email/name from JWT); if no membership, return `{ needsOrg: true }`.
- [ ] **Step 2:** `auth.createOrganization({ name })` (`protectedProcedure`): slugify name (append `-2`, `-3` on collision), call `provisionOrganization` from Task 9. If `BILLING_ENABLED === 'true'`: create a Stripe customer + TRIALING STARTER subscription (14-day trial via `trial_period_days`). If `BILLING_ENABLED !== 'true'` (the free-launch default): skip Stripe entirely — `provisionOrganization` already created a local `Subscription` row as `plan: 'ENTERPRISE', status: 'ACTIVE'` with `stripeCustomerId: null` via `defaultPlanForNewOrg()` (Task 13). Return org either way.
- [ ] **Step 3:** `OnboardingWizard` steps: create org → create first facility (reuse `facility.create`) → show station token QR for tablet setup → invite teammates (Task 19) → done → dashboard.
- [ ] **Step 4:** Test: `auth.bootstrap` is idempotent (call twice → one User row). Commit: `git commit -m "feat(onboarding): self-serve signup, org creation, setup wizard"`

### Task 19: Team invitations

**Files:**
- Create: `apps/api/src/services/invitation.service.ts`, `apps/api/src/lib/email.ts` (Resend), `apps/web/src/features/onboarding/AcceptInvitePage.tsx`
- Modify: `apps/api/src/routers/auth.router.ts`
- Env: `RESEND_API_KEY`, `EMAIL_FROM`

- [ ] **Step 1:** `invitation.create({ email, role })` (`orgAdminProcedure`): token = `crypto.randomUUID()`, `expiresAt = now + 7d`, send email with link `${APP_URL}/invite/${token}`. `invitation.accept({ token })` (`protectedProcedure`): validate not expired/accepted → create `User` row if needed (role from invitation) + `OrganizationMember` → mark `acceptedAt`.
- [ ] **Step 2:** Tests: expired token → `BAD_REQUEST`; double-accept → `BAD_REQUEST`; accept creates membership in the RIGHT org.
- [ ] **Step 3: Commit** — `git commit -m "feat(onboarding): email invitations with role assignment"`

### Task 20: Split marketing site from the app

**Files:**
- Create: `apps/marketing/` (new Vite app; move `apps/web/src/features/{home,process,solutions,about}` + `lib/reactbits`, `lib/scroll` into it)
- Modify: `apps/web` router (app routes only, `/login` default), `netlify.toml` (two-site config or separate Netlify site), `turbo.json` (marketing build task)

- [ ] **Step 1:** Scaffold `apps/marketing` mirroring `apps/web`'s Vite config; move the four feature folders + their shared scroll/GSAP libs; fix imports until `pnpm --filter marketing build` is green.
- [ ] **Step 2:** In `apps/web`, remove the moved folders; root route now redirects unauthenticated → `/login`, authenticated → dashboard. `pnpm --filter web build` green; bundle size should drop noticeably (GSAP/Lenis leave the app bundle).
- [ ] **Step 3:** Netlify: marketing at apex domain, app at `app.` subdomain (`CORS_ORIGIN` in the API's `.env` on the VPS updated to the app origin — see `kvmplan.md`). "Get started" CTA on marketing links to `https://app.<domain>/signup`.
- [ ] **Step 4: Commit** — `git commit -m "refactor(web): split marketing site into apps/marketing"`

---

# Phase 5 — Infrastructure & Operations for Scale

> **Infra note:** the API and all AI agents run on a self-hosted Hostinger KVM4 VPS — see `kvmplan.md` at the repo root for the full server setup, deploy pipeline, Cloudflare configuration, and hardening runbook. This phase assumes that VPS is already provisioned per that file.

### Task 21: Error tracking + observability (do this the same week as Phase 1)

- [ ] Sentry: `@sentry/node` in the API (init in `server.ts` before `buildServer`, capture in tRPC `errorFormatter`), `@sentry/react` in `apps/web`. Env: `SENTRY_DSN`, `VITE_SENTRY_DSN`. Tag every API event with `orgId` for per-tenant debugging.
- [ ] Uptime: BetterStack (or UptimeRobot) monitor on `GET /health` + the frontend URL. Alert → email/Slack.
- [ ] Structured request logging already exists (pino) — add `orgId` to the request log context in `createContext`.

### Task 22: Background job queue (payroll compute + AI digitize off the request path)

- [ ] Add Upstash Redis (free tier) + BullMQ: `pnpm --filter @bin-tracker/api add bullmq ioredis`. Env: `REDIS_URL`.
- [ ] Queue `heavy-jobs` with workers for: `payroll.computeRun` (can exceed request timeouts as orgs grow) and `form.digitizeFromPhoto` (Gemini can take 10–30 s). Pattern: mutation enqueues + returns `jobId`; frontend polls a `job.status` query. Run the worker as a second container in the same `bintracker-api` Compose stack on the VPS initially (its own `mem_limit`/`cpus`, per `kvmplan.md`) — split onto a dedicated container or a second VPS only when Netdata shows sustained CPU contention.
- [ ] Rate limiting: current `@fastify/rate-limit` is per-IP global (100/min). Add per-org limits keyed on `ctx.orgId` for the AI endpoints (the usage metering from Task 15 covers monthly; this covers bursts).

### Task 23: Hosting/scaling decisions (checklist, no code)

| When | Action |
|---|---|
| Launch | Hostinger KVM4 running both the API and all AI agents in isolated Docker stacks (full setup in `kvmplan.md`). Cloudflare free tier in front of the API subdomain (DDoS protection + edge TLS). Supabase Pro ($25/mo, turn on PITR). Netlify free/pro for both sites. Total ≈ $35–45/mo. |
| Growing (20–100 orgs) | Watch Netdata; if the box is consistently pressured, move agents to a second cheap VPS first (cheapest fix) before touching the API's box. Supabase compute add-on. Verify `DATABASE_URL` uses the pooler (`:6543`, already per deployment-guide.md) — mandatory once you run 2 API containers (blue/green under load, or a true second instance). |
| Later (100+ orgs) | Supabase read replica; route heavy dashboard reads to it. Add a second VPS + a load balancer in front of both API boxes for real horizontal scaling. Consider dedicated DB for any enterprise customer that demands isolation (the org-scoped code makes per-tenant DB extraction feasible: `WHERE organizationId = X` export). |

Self-hosting was a deliberate choice (see `kvmplan.md`), made because there are no live customers yet — the ops burden (deploys, TLS, crash recovery, monitoring) is fully owned via that runbook rather than delegated to a PaaS. Revisit only if the box becomes a genuine operational bottleneck; the API's Docker image is portable to a managed platform later with no code changes if that ever becomes the better trade.

### Task 24: Production security checklist (verify before public launch)

- [ ] `DISABLE_AUTH` cannot activate in prod (Task 1 test proves it) AND the env var is not set in any VPS `.env` file at all.
- [ ] UFW/Caddy on the VPS only accepts inbound traffic from Cloudflare's published IP ranges (see `kvmplan.md`) — prevents bypassing Cloudflare's DDoS protection by hitting the origin IP directly.
- [ ] `grep -rn "publicProcedure" apps/api/src/routers/` → only `auth.router.ts`.
- [ ] Tenancy audit script (Task 8) wired into CI and green.
- [ ] Stripe webhook signature verification tested with a bogus signature → 400.
- [ ] Supabase JWT verification (`lib/jwt.ts`) checks issuer + audience, not just signature.
- [ ] CORS_ORIGIN is the exact app origin (no wildcard).
- [ ] Rate limits on auth-adjacent endpoints; invitation tokens expire (Task 19).
- [ ] Every org has an `OrganizationModule` row for every `ModuleKey` it's entitled to (Task 12) — spot-check a few orgs; a missing row silently denies access rather than granting it, so this fails safe but should still be verified.
- [ ] Run `/security-review` (Claude Code) on the full diff of Phases 1–4 before launch.
- [ ] Rotate any secrets currently in the local `.env` that were ever committed or shared.

---

# Milestone Acceptance Criteria

| Milestone | Done when |
|---|---|
| M1: Hardened (Phase 1) | No tenant router is public; bypass impossible in prod; all tests green in CI. |
| M2: Multi-tenant (Phase 2) | Two orgs seeded locally; isolation test proves zero cross-tenant reads; prod migrated via Task 10 runbook with zero data loss. |
| M3: Monetized (Phase 3, built but OFF by default) | With `BILLING_ENABLED=false`: every new signup gets full access for free, zero billing UI shown, `requireModule`/usage metering still fully enforced (module gating is independent of billing). With `BILLING_ENABLED=true` (flip when ready to charge): Stripe test-mode signup → trial → upgrade → the correct module bundle unlocks live via webhook reconciliation; downgrade → plan-sourced modules lock (manual overrides survive). Platform admin can independently toggle any module for any org via `/admin/orgs` regardless of billing state. |
| M4: Self-serve (Phase 4) | A stranger can sign up, create an org, set up a facility tablet, invite a teammate, and run a bin cycle with zero manual intervention. |
| M5: Operable (Phase 5) | Sentry receiving events tagged by org; uptime monitor live; heavy jobs off the request path; security checklist 100%. |

**Estimated effort:** Phase 1: 2–3 days · Phase 2: 1.5–2 weeks · Phase 3: 1.5 weeks (grew from 5 to 7 tasks for the module system) · Phase 4: 1 week · Phase 5: 2–3 days spread throughout, plus ~1 day for VPS provisioning per `kvmplan.md` before Phase 1 begins. ≈ 6–7 focused weeks total.
