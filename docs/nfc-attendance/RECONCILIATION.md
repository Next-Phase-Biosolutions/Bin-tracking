# NFC tag attendance: reconciliation plan

Port of the [employee-clockin-clockout](https://github.com/aymanabattar/employee-clockin-clockout) prototype into Bin-tracking's existing Workforce and Payroll modules. Nothing here creates a second employee or payroll system. Posted before implementation, as required.

**Decisions already made with the owner**
- Base branch is `main`. There is no `dev` branch on origin, and CONTRIBUTING.md is stale on this point.
- Cookies: add a Netlify `/trpc/*` rewrite so the phone pages stay same-origin (see 3.3).

## 1. What the code does today (verified in the repo)

| Area | Fact |
|---|---|
| Attendance | `attendance.scan` is `orgProcedure` + `WORKFORCE`, callable by any org member. It runs in a Serializable transaction. There is no lock and no DB guarantee of one open shift. |
| Auto-close | `autoCloseStaleSessions()` is never scheduled or called (dead code). |
| Payroll SQL | `computeRun` pays only `checkOutAt IS NOT NULL AND autoClosed = false`. The exception query is `checkOutAt IS NULL OR autoClosed = true`. There is no approval concept except `FIX_CHECKOUT`, which caps at 16 h. |
| Payroll ownership | `APPROVED` / `PAID`, the 2FA code and payouts live in the separate payment-agent repo. This PR does not touch `payroll_*` tables, `ZumPayee` or bank fields. |
| Cookies | None. `createContext(req)` reads only the Bearer token and `x-org-id`, and has no reply object. `@fastify/cookie` is not installed. |
| Deploy | The web app is on Netlify at the apex under `/app/` (vite `base: '/app/'`). The API is at `api.nextphasebiosolutions.com` via Caddy. `netlify.toml` has no `/trpc` rule. Phone URLs therefore have to be `/app/tap` and `/app/register`. |
| Tests | Every API test, including the tenancy suite, uses in-memory Prisma fakes. CI starts a Postgres service that nothing uses. The web app has no jsdom or testing-library. |
| Tenancy | `WorkSession` and `AttendanceEvent` have no `organizationId`; the org filter goes through `Employee`. `apps/api/scripts/tenancy-audit.sh` fails CI on a service Prisma call that lacks `organizationId` on the same line. |

## 2. Models: reuse / extend / add

| Model | Action | Change |
|---|---|---|
| `Employee` | **reuse** | None. `hourlyRateCents` stays nullable and falls back to `Settings.flatHourlyRateCents`. No new column, so the bank-field `omit` extension is untouched. |
| `WorkSession` | **extend** | `+ approvedAt DateTime?`. Reuse `autoClosed`. Partial unique index `ON (employeeId) WHERE checkOutAt IS NULL` via raw SQL. The migration first closes any pre-existing duplicate open rows (all but the newest, flagged `autoClosed`, so they surface as payroll exceptions and are never silently paid). |
| `AttendanceEvent` | **extend** | `AttendanceEventType` gains `DEBOUNCED`, `REJECTED`, `REGISTERED` (isolated enum migration, per `db-migrations.test.ts`). `sessionId` becomes nullable. `source` stays and is set to `"nfc"`. No `organizationId` is added, because the org stays derived through `Employee` as today. |
| `NfcCard` + `NfcDirection` (`IN`/`OUT`/`BOTH`) | **add** | `organizationId`, `label`, `direction`, `chipUid`, `active`. Unique on `(organizationId, chipUid)`. |
| `RegistrationToken` | **add** | `organizationId`, `employeeId` (cascade), `tokenHash` unique, `expiresAt`, `usedAt?`, `supersededAt?`. Hashed with `lib/token.ts` `hashToken`. |
| `DeviceSession` | **add** | `organizationId`, `employeeId` (cascade), `sessionTokenHash` unique, `deviceLabel` (derived from the user agent; the prototype never wrote it), `lastUsedAt?`, `revokedAt?`. |
| Row-level security | **add** | `ENABLE ROW LEVEL SECURITY` (never `FORCE`) on the three new tables, with a `db-migrations.test.ts` assertion. |
| `ModuleKey` | **reuse `WORKFORCE`** | NFC is a way of capturing attendance, not a separately sold feature. A new key would need an enum migration, a second declaration in `entitlements.ts`, a backfill for existing orgs, plan bundles and admin-UI wiring, all for no billing distinction today. Revisit if NFC becomes an add-on. |
| `PayrollRun` / `PayrollLineItem` / `PayrollException` | **reuse, not ported** | Exception types stay `NO_CHECKOUT` and `AUTO_CLOSED`. |

## 3. Procedures: reuse / extend / add

### 3.1 Admin side: `orgOpsProcedure` (ADMIN/OPS_MANAGER) + `requireModule('WORKFORCE')`, org-scoped
| Procedure | Action |
|---|---|
| `nfcCard.list/create/update/delete/setActive` | **add** (new `nfc-card` router + service). Rules ported: `DUPLICATE_CHIP_UID`, partial update, the id is what the tag URL carries, delete always allowed. |
| `deviceRegistration.sendLink / listDevices / revokeDevice` | **add** (new `device-registration` router + service). Link TTL 48 h; a new link supersedes older unused ones; inactive employee refused; revoke is idempotent. |
| `attendance.facilityStatus` | **extend** the attendance router. Three buckets (checked in, open ≥16 h, checked out), plus the count of active employees with no registered phone. Selects `id`, `fullName`, `employeeCode` only, so no rates and no QR code leak. |
| `attendance.listPendingApprovals` / `approveWorkSession` | **extend**. Guards: only auto-closed, only once, check-out after check-in and not in the future, `OVERLAPS_NEXT_SESSION`. |

### 3.2 Employee side: the only procedures not behind a user JWT
| Procedure | Auth | Notes |
|---|---|---|
| `deviceRegistration.start({token})` | `publicProcedure`; the single-use hashed token is the credential | Rate-limited (existing `SlidingWindowLimiter` pattern). Sets a 10-minute pending cookie holding a SHA-256 hex digest. Error order is ported: used, then superseded, then expired. |
| `attendance.tap({cardId})` | `publicProcedure` + device cookie, resolved through a hashed `DeviceSession` | The org comes from the card and the device row, never from client input. The card's org, the device's org and the employee's org must all match, otherwise a generic "card not found". WORKFORCE must be enabled for that org. With a pending cookie present it completes registration (as the prototype's `/tap` did). |

### 3.3 Existing code that changes
| Item | Change |
|---|---|
| `attendance.scan` (QR) | Routed through the same core as the tap: per-employee advisory lock + in-memory queue + partial index. Response shape unchanged. **Separate commit, so it can be dropped without losing the NFC work.** |
| `attendance.recent` | Excludes `DEBOUNCED` rows, so the new event types do not spam the feed. |
| `payroll.computeRun` | Both raw queries learn `approvedAt`: pay `autoClosed = false OR approvedAt IS NOT NULL`; exception only if `autoClosed AND approvedAt IS NULL`. Before computing it lazily closes the org's own stale open shifts (≥16 h) under the lock, scoped by `organizationId`. |
| `payroll.resolveException` (`FIX_CHECKOUT`) | Gains the same `OVERLAPS_NEXT_SESSION` guard. The existing 16 h cap is kept. |
| `autoCloseStaleSessions` | Removed (dead, global) and replaced by the org-scoped lazy close above. |
| `createContext` | Gains `res` plus `cookies` / `setCookie` / `clearCookie`. `@fastify/cookie` (Fastify 5 line) is registered. `DB_POOL_MAX` is added to the pg adapter. |
| `netlify.toml` | Adds `/trpc/*` → `https://api.nextphasebiosolutions.com/trpc/:splat` (status 200, before the other rules). The phone pages call the relative `/trpc`, so the cookie is first-party. **Needs a Netlify deploy after merge.** |

## 4. Auth and security
- Cookies are `httpOnly`, `Secure` (off only with `COOKIE_SECURE=false` for local http), `SameSite=Lax`, `Path=/`. Device cookie is about 1 year; pending cookie is 10 minutes. Raw tokens are never stored.
- Mutations that rely on a cookie also check that the `Origin` header, when present, matches the allowed web origin (defence in depth on top of SameSite).
- NUL bytes are rejected in every new string input (`text()` refine). The pending cookie is validated as `/^[0-9a-f]{64}$/` before any lookup.
- Rate limits are per device session, per card, and per token. They do not rely on client IP (see risk R1).
- **A tap is not proof of presence.** The card id is a string in a URL. Anyone who has an enrolled phone and the URL can punch from anywhere. This is documented in the docs section. See "Proposals".

## 5. Concurrency
`withKeyMutex` (in-process FIFO per employee) + `withLock` (`pg_advisory_xact_lock(hashtextextended(key,0))` in an interactive transaction). It maps pool timeouts (`P2024`/`P2028`) to `SERVER_BUSY` (HTTP 429), and retries serialization failures, deadlocks and `P2002`, recognising the driver-adapter shape (`DriverAdapterError: TransactionWriteConflict`) as well as `P2034`. The prototype's standalone `withSerializableRetry` is dead code there, so its logic lives inside `withLock` only. `cycle.service` and `bin.service` keep their own Serializable transactions untouched (out of scope).

## 6. Web (`apps/web`)
- **Public routes** `/app/register` and `/app/tap` in the same group as `bank-details/:token`. They use a vanilla tRPC client pinned to the relative `/trpc`, because `VITE_API_URL` would point at a different origin and the hooks do not settle on these pages. They show the "Waking up, please wait…" state with up to 3 retries on a gateway error or 429, an in-app-browser banner (WhatsApp, Instagram, Facebook), and mobile-first copy.
- **Admin:** NFC cards page (CRUD, tag URL `…/app/tap?card=<id>` with a copy button, direction-change confirmation). Employees page gets a phone column (send link, device list, revoke). A live status page refreshes every 5 s and holds the pending-approvals section. All use `lib/refresh.ts` (cancel, then invalidate) and sit behind `WORKFORCE` and the ADMIN/OPS_MANAGER role in `nav.ts`.
- **Web tests** need `jsdom` and `@testing-library/*` as new devDependencies (opt-in per file), plus a `renderWithTrpc`-style helper.

## 7. Migrations
Two, in order: (1) the isolated `ALTER TYPE "AttendanceEventType" ADD VALUE` statements; (2) schema: `approvedAt`, nullable `sessionId`, `NfcDirection`, three tables, RLS, duplicate cleanup, then the partial unique index. Generated with `pnpm db:migrate:dev` against a local database only, and never run against production.

## 8. Tests
- **Existing fake-based style:** extend `tenancy-isolation.test.ts` with the new models (org A data invisible to org B for every new procedure), validators, and role enforcement (DRIVER/WORKER rejected on every admin procedure).
- **New DB-backed lane (`*.db.test.ts`):** runs only when `DATABASE_URL` is localhost and the database name ends in `_test`, otherwise skipped. It runs in CI automatically because the Postgres service already exists. It covers toggle, strict direction, debounce, mismatch results, auto-close at 16 h, approval guards, registration, the 300-tap rush, the advisory lock, the one-open-session index, NUL and cookie hardening, and payroll integration through the real SQL (NFC sessions give the right minutes; auto-closed ones become exceptions and become pay once approved).
- No test sweeps stale shifts across organizations: the close is org-scoped, and DB tests use their own database.
- The prototype's `sim/` and `*.sim.ts` suites are **not ported**: the stress, rush and boundary cases are covered in the DB lane.
- Before the PR: `pnpm lint` (only `apps/api` defines it), `pnpm typecheck`, `pnpm test` and `pnpm build`.

## 9. Deviations from the prototype
1. Routes are `/app/tap` and `/app/register` (the web app's base path), not `/tap` and `/register`.
2. Procedures are org-scoped and role-gated; the only exceptions are the two employee-side ones above.
3. `closeAllStale` (global) becomes an org-scoped lazy close.
4. `PayrollRun`, the payroll page and `PAYROLL_TIMEZONE` are replaced by the existing payroll and `Settings.companyTimezone`.
5. `Employee.email` stays as it is today (not globally unique).
6. `withSerializableRetry` is folded into `withLock`.
7. The "zero-auth" prototype tests are inverted instead of ported.
8. `DeviceSession.deviceLabel` is now actually written.
9. The employee-delete race the prototype left (a tap between the history check and the delete) is out of scope: this PR does not port employee delete.

## 10. Proposals (not silently skipped, not in this PR unless you say so)
1. **Signed or rotating per-card token in the tag URL** (NTAG 424 DNA SUN), which is what makes a tap proof of presence. Written up in `docs/superpowers/plans/2026-10-05-nfc-phone-tap-attendance.md`.
2. Restrict `attendance.summary` / `recent` to ADMIN/OPS_MANAGER (today any member, including drivers, can read everyone's hours).
3. A scheduled org-scoped auto-close, so the timesheet stops counting capped sessions as worked time.
4. Fix `Employee.qrCode` being listable plaintext.

## 11. Risks and what I cannot verify
- **R1: Rate limiting behind the proxy.** The global limiter is 100 requests/min per `req.ip`, and `trustProxy` is unset. Through Netlify and Caddy every phone tap may arrive from the same IP, so a shift-start burst could hit one shared bucket. I make the limit configurable (`RATE_LIMIT_MAX`, default unchanged) but cannot confirm the real IP behaviour without staging.
- Cookie persistence through the Netlify rewrite on **iPhone Safari** is unverified. The prototype checked it only in headless Chrome.
- Whether **production** has employees with more than one open session (the migration handles it, but run `SELECT "employeeId", count(*) FROM work_sessions WHERE "checkOutAt" IS NULL GROUP BY 1 HAVING count(*) > 1` read-only first).
- Netlify's actual environment variables (`VITE_API_URL` etc.) are not in the repo.
- Physical tag writing and phone testing are out of scope; the checklist ships in the docs section.
