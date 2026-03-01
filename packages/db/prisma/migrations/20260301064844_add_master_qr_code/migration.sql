/*
  Warnings:

  - A unique constraint covering the columns `[masterQrCode]` on the table `bin_types` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "bin_cycles_one_active_per_bin";

-- AlterTable
ALTER TABLE "bin_types" ADD COLUMN     "masterQrCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bin_types_masterQrCode_key" ON "bin_types"("masterQrCode");
