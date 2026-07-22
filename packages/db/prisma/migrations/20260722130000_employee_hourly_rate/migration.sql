-- Per-employee pay rate override, in cents.
--
-- Nullable by design: NULL means "fall back to the org's
-- Settings.flatHourlyRateCents" (payroll.service resolves the effective rate at
-- compute time). Every existing row is NULL, so behaviour is unchanged until an
-- admin sets an override. Additive-only — the payout agent, which reads this
-- table, ignores columns it doesn't know about.
ALTER TABLE "employees"
    ADD COLUMN "hourlyRateCents" INTEGER;
