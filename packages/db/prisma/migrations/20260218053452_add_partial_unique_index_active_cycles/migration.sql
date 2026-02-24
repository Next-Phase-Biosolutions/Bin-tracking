-- Partial unique index: only ONE active/in-transit cycle allowed per bin.
-- COMPLETED cycles are historical records and can be unlimited.
-- DB-level guard on top of the application-level serializable transaction check.
CREATE UNIQUE INDEX "bin_cycles_one_active_per_bin"
ON "bin_cycles" ("binId")
WHERE "status" IN ('ACTIVE', 'IN_TRANSIT');