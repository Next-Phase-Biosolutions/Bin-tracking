# Attendance Logs

Menu: **Attendance Logs** (directly under Timesheet). Visible to ADMIN and OPS_MANAGER with the WORKFORCE module.

## Flow
Month bar (Jan–Dec, year arrows) → calendar for that month (days show "N in") → click a day → table of employees with first clock-in, last clock-out and **total hours**.
URL is shareable: `/app/attendance-logs?month=YYYY-MM&date=YYYY-MM-DD`.

## Rules
- **Day assignment**: a shift belongs to the day of its *clock-in* in the company timezone (`Settings.companyTimezone`), exactly like payroll. Overnight shifts show "+1 day" on the clock-out. DST-safe (done in Postgres with `AT TIME ZONE`).
- **Multiple clock-ins**: the row shows the first clock-in and last clock-out, but **Total = sum of the sessions** (breaks excluded), so it always equals payroll. Rows expand to show each session and the break time.
- **Counted vs. held**: COMPLETE shifts count. Still-in, overdue (open ≥ 16 h) and auto-closed shifts are shown with a status but are **not counted** until approved (same as payroll).
- Future days/months are disabled. Weeks start on Sunday. Works for both NFC taps and QR scans.
- **Export CSV**: BOM + CRLF, decimal hours and minutes, formula-injection guard (cells starting `= + - @` are prefixed with `'`).

## API (tRPC, manager-only, WORKFORCE module)
- `attendance.logsMonth({ year, month })` → `{ timezone, today, days: [{ date, employees }] }`
- `attendance.logsDay({ date })` → rows, sessions, summary `{ employees, totalMinutes, stillIn, overdue, awaitingApproval }`

Tenancy: `work_sessions` has no organizationId, so every query joins `employees` on `organizationId`.

## Code map
`apps/api/src/lib/attendance-day-log.ts` (pure logic) · `apps/api/src/services/attendance-logs.service.ts` (SQL) · `apps/web/src/features/attendance-logs/` (UI) · `packages/validators/src/attendance.schema.ts`.
