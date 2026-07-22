-- Append-only audit trail for money-adjacent payroll config changes:
-- org settings updates, per-employee rate changes, and module toggles.
-- No foreign keys by design — entries must survive any future cleanup of
-- the rows they describe.
CREATE TABLE "payroll_audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_audit_logs_orgId_createdAt_idx" ON "payroll_audit_logs"("orgId", "createdAt");
