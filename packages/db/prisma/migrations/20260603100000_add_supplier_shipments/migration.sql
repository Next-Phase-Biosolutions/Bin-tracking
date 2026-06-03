-- CreateEnum
CREATE TYPE "ShipmentCondition" AS ENUM ('GOOD', 'DAMAGED');

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "shipmentCode" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "reference" TEXT,
    "contents" TEXT,
    "quantity" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "condition" "ShipmentCondition" NOT NULL DEFAULT 'GOOD',
    "conditionNote" TEXT,
    "receivedBy" TEXT,
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipmentCode_key" ON "shipments"("shipmentCode");

-- CreateIndex
CREATE INDEX "shipments_receivedAt_idx" ON "shipments"("receivedAt");

-- CreateIndex
CREATE INDEX "shipments_supplier_idx" ON "shipments"("supplier");

-- CreateIndex
CREATE INDEX "shipments_facilityId_idx" ON "shipments"("facilityId");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
