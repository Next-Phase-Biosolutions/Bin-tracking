-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('standard', 'checklist', 'matrix', 'repeating');

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "schema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_templates_stage_isActive_idx" ON "form_templates"("stage", "isActive");
