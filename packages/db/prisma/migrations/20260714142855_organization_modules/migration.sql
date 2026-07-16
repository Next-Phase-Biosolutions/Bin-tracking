-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('ANIMAL_INTAKE', 'WORKFORCE', 'SHIPMENTS', 'FORMS', 'FORMS_AI_DIGITIZE', 'BLOCKCHAIN_ANCHOR', 'PAYROLL');

-- CreateTable
CREATE TABLE "organization_modules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'plan',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_modules_orgId_idx" ON "organization_modules"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_modules_orgId_module_key" ON "organization_modules"("orgId", "module");

-- AddForeignKey
ALTER TABLE "organization_modules" ADD CONSTRAINT "organization_modules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
