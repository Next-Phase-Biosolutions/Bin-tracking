-- Backfill: this migration's SET NOT NULL statements below fail against any
-- database with pre-existing rows (production already has them — the
-- "no live data yet" assumption from the additive migration's era is stale).
-- Assign every legacy row to a "Default Organization" before enforcing the
-- constraint, mirroring packages/db/src/backfill-org.ts's tenant-table loop
-- so `migrate deploy` alone is sufficient on any environment. Idempotent:
-- ON CONFLICT DO NOTHING + "IS NULL" guards make re-runs a no-op, and this
-- is a no-op on empty databases (CI, fresh dev) since there are no rows to touch.
DO $$
DECLARE
  default_org_id TEXT;
BEGIN
  INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'Default Organization', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("slug") DO NOTHING;

  SELECT "id" INTO default_org_id FROM "organizations" WHERE "slug" = 'default';

  -- Legacy org keeps full access, matching backfill-org.ts (requireModule
  -- denies orgs without an enabled module/subscription otherwise).
  INSERT INTO "subscriptions" ("id", "orgId", "plan", "status", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, default_org_id, 'ENTERPRISE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("orgId") DO NOTHING;

  UPDATE "facilities" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "bin_types" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "bins" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "bin_cycles" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "employees" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "shipments" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "form_templates" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "animal_registrations" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "settings" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  UPDATE "payroll_runs" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
END $$;

-- DropIndex
-- IF EXISTS: production's index set has drifted from migration history
-- (these legacy unique indexes are already gone there), so a plain DROP
-- INDEX fails with "does not exist" on that environment. IF EXISTS makes
-- the statement work regardless of which environment's actual index state
-- it runs against.
DROP INDEX IF EXISTS "bin_types_masterQrCode_key";

-- DropIndex
DROP INDEX IF EXISTS "bin_types_organType_key";

-- DropIndex
DROP INDEX IF EXISTS "bins_qrCode_key";

-- DropIndex
DROP INDEX IF EXISTS "employees_employeeCode_key";

-- DropIndex
DROP INDEX IF EXISTS "employees_qrCode_key";

-- DropIndex
DROP INDEX IF EXISTS "payroll_runs_period_key";

-- DropIndex
DROP INDEX IF EXISTS "settings_organizationId_idx";

-- DropIndex
DROP INDEX IF EXISTS "settings_singleton_key";

-- DropIndex
DROP INDEX IF EXISTS "shipments_shipmentCode_key";

-- AlterTable
ALTER TABLE "animal_registrations" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "bin_cycles" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "bin_types" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "bins" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "facilities" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "form_templates" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "payroll_runs" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "settings" DROP COLUMN "singleton",
ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "shipments" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "bin_types_organizationId_organType_key" ON "bin_types"("organizationId", "organType");

-- CreateIndex
CREATE UNIQUE INDEX "bin_types_organizationId_masterQrCode_key" ON "bin_types"("organizationId", "masterQrCode");

-- CreateIndex
CREATE UNIQUE INDEX "bins_organizationId_qrCode_key" ON "bins"("organizationId", "qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organizationId_employeeCode_key" ON "employees"("organizationId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organizationId_qrCode_key" ON "employees"("organizationId", "qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organizationId_period_key" ON "payroll_runs"("organizationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "settings_organizationId_key" ON "settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_organizationId_shipmentCode_key" ON "shipments"("organizationId", "shipmentCode");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_types" ADD CONSTRAINT "bin_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cycles" ADD CONSTRAINT "bin_cycles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_registrations" ADD CONSTRAINT "animal_registrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

