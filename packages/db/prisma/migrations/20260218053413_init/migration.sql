-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('PROCESSING', 'RENDERING');

-- CreateEnum
CREATE TYPE "BinStatus" AS ENUM ('IDLE', 'ACTIVE', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('ACTIVE', 'IN_TRANSIT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ComplianceResult" AS ENUM ('ON_TIME', 'LATE');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('CRITICAL', 'MEDIUM', 'STANDARD', 'LOW');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIN_STARTED', 'PICKED_UP', 'DELIVERED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPS_MANAGER', 'DRIVER', 'WORKER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_facilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL DEFAULT 'PROCESSING',
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Tablet',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_types" (
    "id" TEXT NOT NULL,
    "organType" TEXT NOT NULL,
    "dkHours" INTEGER NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "binTypeId" TEXT NOT NULL,
    "currentFacilityId" TEXT NOT NULL,
    "status" "BinStatus" NOT NULL DEFAULT 'IDLE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_cycles" (
    "id" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "destinationId" TEXT,
    "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "driverId" TEXT,
    "vehicleId" TEXT,
    "complianceResult" "ComplianceResult",
    "anchored" BOOLEAN NOT NULL DEFAULT false,
    "anchorTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bin_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stationId" TEXT,
    "driverId" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_facilities_userId_idx" ON "user_facilities"("userId");

-- CreateIndex
CREATE INDEX "user_facilities_facilityId_idx" ON "user_facilities"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "user_facilities_userId_facilityId_key" ON "user_facilities"("userId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "stations_token_key" ON "stations"("token");

-- CreateIndex
CREATE INDEX "stations_facilityId_idx" ON "stations"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "bin_types_organType_key" ON "bin_types"("organType");

-- CreateIndex
CREATE UNIQUE INDEX "bins_qrCode_key" ON "bins"("qrCode");

-- CreateIndex
CREATE INDEX "bins_status_idx" ON "bins"("status");

-- CreateIndex
CREATE INDEX "bins_currentFacilityId_idx" ON "bins"("currentFacilityId");

-- CreateIndex
CREATE INDEX "bins_binTypeId_idx" ON "bins"("binTypeId");

-- CreateIndex
CREATE INDEX "bin_cycles_binId_status_idx" ON "bin_cycles"("binId", "status");

-- CreateIndex
CREATE INDEX "bin_cycles_status_idx" ON "bin_cycles"("status");

-- CreateIndex
CREATE INDEX "bin_cycles_deadline_idx" ON "bin_cycles"("deadline");

-- CreateIndex
CREATE INDEX "bin_cycles_facilityId_idx" ON "bin_cycles"("facilityId");

-- CreateIndex
CREATE INDEX "event_logs_cycleId_idx" ON "event_logs"("cycleId");

-- CreateIndex
CREATE INDEX "event_logs_eventType_idx" ON "event_logs"("eventType");

-- CreateIndex
CREATE INDEX "event_logs_timestamp_idx" ON "event_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "user_facilities" ADD CONSTRAINT "user_facilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_facilities" ADD CONSTRAINT "user_facilities_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_binTypeId_fkey" FOREIGN KEY ("binTypeId") REFERENCES "bin_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_currentFacilityId_fkey" FOREIGN KEY ("currentFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cycles" ADD CONSTRAINT "bin_cycles_binId_fkey" FOREIGN KEY ("binId") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cycles" ADD CONSTRAINT "bin_cycles_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cycles" ADD CONSTRAINT "bin_cycles_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cycles" ADD CONSTRAINT "bin_cycles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "bin_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
