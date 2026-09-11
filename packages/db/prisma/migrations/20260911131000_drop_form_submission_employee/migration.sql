-- DropForeignKey
ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_employeeId_fkey";

-- DropIndex
DROP INDEX "form_submissions_employeeId_idx";

-- AlterTable
ALTER TABLE "form_submissions" DROP COLUMN "employeeId";
