-- CreateTable
CREATE TABLE "sensor_devices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tempC" DOUBLE PRECISION NOT NULL,
    "humidityPct" DOUBLE PRECISION NOT NULL,
    "nh3Ppm" DOUBLE PRECISION,
    "tvoc" DOUBLE PRECISION,
    "eco2Ppm" DOUBLE PRECISION,
    "aqhiPlus" DOUBLE PRECISION,
    "ozonePpb" DOUBLE PRECISION,
    "pressure" DOUBLE PRECISION,
    "pm25" DOUBLE PRECISION,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sensor_devices_externalId_key" ON "sensor_devices"("externalId");

-- CreateIndex
CREATE INDEX "sensor_devices_organizationId_idx" ON "sensor_devices"("organizationId");

-- CreateIndex
CREATE INDEX "sensor_devices_facilityId_idx" ON "sensor_devices"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "sensor_readings_deviceId_timestamp_key" ON "sensor_readings"("deviceId", "timestamp");

-- AddForeignKey
ALTER TABLE "sensor_devices" ADD CONSTRAINT "sensor_devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_devices" ADD CONSTRAINT "sensor_devices_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sensor_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EnableRowLevelSecurity
-- Hand-added (not Prisma-generated): the repo's blanket RLS migration
-- (20260731090000_enable_rls_public_tables) only covered tables that existed
-- when it ran. New tables do not inherit it automatically, so every new
-- table needs this explicitly. ENABLE only — never FORCE, which strips the
-- owner exemption Prisma's connection relies on and breaks every query
-- (see that migration's header comment for the measured failure mode).
ALTER TABLE "sensor_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sensor_readings" ENABLE ROW LEVEL SECURITY;
