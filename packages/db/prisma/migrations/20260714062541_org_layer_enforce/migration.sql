-- DropIndex
DROP INDEX "bin_types_masterQrCode_key";

-- DropIndex
DROP INDEX "bin_types_organType_key";

-- DropIndex
DROP INDEX "bins_qrCode_key";

-- DropIndex
DROP INDEX "employees_employeeCode_key";

-- DropIndex
DROP INDEX "employees_qrCode_key";

-- DropIndex
DROP INDEX "payroll_runs_period_key";

-- DropIndex
DROP INDEX "settings_organizationId_idx";

-- DropIndex
DROP INDEX "settings_singleton_key";

-- DropIndex
DROP INDEX "shipments_shipmentCode_key";

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

