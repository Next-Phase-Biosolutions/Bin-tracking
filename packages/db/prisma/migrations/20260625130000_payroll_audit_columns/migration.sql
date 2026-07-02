-- AlterTable
ALTER TABLE "payroll_line_items" ADD COLUMN "payoutRef" TEXT;

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN "approvalCodeHash" TEXT,
ADD COLUMN "approvalExpiresAt" TIMESTAMP(3),
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "computedAt" TIMESTAMP(3);
