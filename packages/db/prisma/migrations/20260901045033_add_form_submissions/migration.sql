-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission_audit_logs" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "oldValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_submissions_organizationId_idx" ON "form_submissions"("organizationId");

-- CreateIndex
CREATE INDEX "form_submissions_formId_idx" ON "form_submissions"("formId");

-- CreateIndex
CREATE INDEX "form_submissions_employeeId_idx" ON "form_submissions"("employeeId");

-- CreateIndex
CREATE INDEX "form_submission_audit_logs_submissionId_idx" ON "form_submission_audit_logs"("submissionId");

-- CreateIndex
CREATE INDEX "form_submission_audit_logs_orgId_createdAt_idx" ON "form_submission_audit_logs"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_audit_logs" ADD CONSTRAINT "form_submission_audit_logs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "form_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS on both new tables, no policies — same treatment and same
-- reasoning as 20260731090000_enable_rls_public_tables (blocks anonymous
-- PostgREST access via the public Supabase anon key; the Prisma connection
-- owns these tables and is exempt, so app queries are unaffected). That
-- migration only covered tables that existed when it ran, so new tables
-- must opt in here individually to keep the "every public table has RLS
-- enabled" invariant intact. NEVER add FORCE ROW LEVEL SECURITY — see that
-- migration's file for why (strips the owner exemption, breaks every query).
ALTER TABLE "form_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_submission_audit_logs" ENABLE ROW LEVEL SECURITY;
