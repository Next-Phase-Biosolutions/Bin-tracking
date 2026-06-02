-- CreateEnum
CREATE TYPE "FormTriggerType" AS ENUM ('on_arrival', 'on_cycle_start', 'scheduled', 'manual', 'inspection', 'other');

-- CreateEnum
CREATE TYPE "FormFillFrequency" AS ENUM ('per_animal', 'per_shift', 'daily', 'weekly', 'as_needed');

-- AlterTable
ALTER TABLE "form_templates" ADD COLUMN "sourceImageUrl" TEXT,
ADD COLUMN "triggerType" "FormTriggerType",
ADD COLUMN "triggerConfig" JSONB,
ADD COLUMN "fillFrequency" "FormFillFrequency";
