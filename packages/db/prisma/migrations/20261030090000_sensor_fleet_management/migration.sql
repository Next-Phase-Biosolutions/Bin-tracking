-- Sensor fleet management.
--   * Devices get a lifecycle (UNASSIGNED -> ACTIVE <-> DEACTIVATED) and can exist
--     before they belong to a tenant, so organizationId/facilityId become nullable.
--   * Zones become a per-facility table (replaces the hard-coded zone ids), seeded
--     below with the six that existed so every current link keeps working.
--   * Every reading is stamped with the organization that owned the device when it
--     arrived, so reassigning a device never moves history between tenants.
--   * Adds the unknown-id log, device audit log and platform settings tables.
-- Existing rows are preserved: status 'ACTIVE' -> state ACTIVE (anything else ->
-- DEACTIVATED), assignedAt = createdAt, zone text -> zoneId, readings stamped from
-- their device's organization.

-- CreateEnum
CREATE TYPE "SensorDeviceState" AS ENUM ('UNASSIGNED', 'ACTIVE', 'DEACTIVATED');

-- AlterTable: new device columns first, keeping the old status/zone for the backfill
ALTER TABLE "sensor_devices"
    ADD COLUMN "state" "SensorDeviceState" NOT NULL DEFAULT 'UNASSIGNED',
    ADD COLUMN "assignedAt" TIMESTAMP(3),
    ADD COLUMN "zoneId" TEXT,
    ALTER COLUMN "organizationId" DROP NOT NULL,
    ALTER COLUMN "facilityId" DROP NOT NULL;

UPDATE "sensor_devices"
SET "state" = CASE WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"SensorDeviceState" ELSE 'DEACTIVATED'::"SensorDeviceState" END,
    "assignedAt" = "createdAt";

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'grid',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zones_facilityId_idx" ON "zones"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "zones_facilityId_slug_key" ON "zones"("facilityId", "slug");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the six default zones for every existing (non-deleted) facility.
INSERT INTO "zones" ("id", "facilityId", "slug", "name", "icon", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f."id", z."slug", z."name", z."icon", z."ord", now(), now()
FROM "facilities" f
CROSS JOIN (VALUES
    ('receiving',  'Receiving',  'truck', 0),
    ('killfloor',  'Kill Floor', 'blade', 1),
    ('processing', 'Processing', 'knife', 2),
    ('wetaging',   'Wet Aging',  'snow',  3),
    ('valueadd',   'Value Add',  'box',   4),
    ('shipping',   'Shipping',   'ship',  5)
) AS z("slug", "name", "icon", "ord")
WHERE f."deletedAt" IS NULL;

-- Point existing devices at their zone row, then drop the old text columns.
UPDATE "sensor_devices" d
SET "zoneId" = z."id"
FROM "zones" z
WHERE z."facilityId" = d."facilityId" AND z."slug" = d."zone";

ALTER TABLE "sensor_devices" DROP COLUMN "status", DROP COLUMN "zone";

-- CreateIndex
CREATE INDEX "sensor_devices_state_idx" ON "sensor_devices"("state");

-- AddForeignKey
ALTER TABLE "sensor_devices" ADD CONSTRAINT "sensor_devices_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: stamp every existing reading with its device's organization.
ALTER TABLE "sensor_readings" ADD COLUMN "organizationId" TEXT;

UPDATE "sensor_readings" r
SET "organizationId" = d."organizationId"
FROM "sensor_devices" d
WHERE r."deviceId" = d."id";

-- CreateIndex
CREATE INDEX "sensor_readings_organizationId_deviceId_timestamp_idx" ON "sensor_readings"("organizationId", "deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_timestamp_idx" ON "sensor_readings"("timestamp");

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "unknown_sensor_device_ids" (
    "externalId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "unknown_sensor_device_ids_pkey" PRIMARY KEY ("externalId")
);

-- CreateIndex
CREATE INDEX "unknown_sensor_device_ids_lastSeenAt_idx" ON "unknown_sensor_device_ids"("lastSeenAt");

-- CreateTable
CREATE TABLE "sensor_device_audit_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_device_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sensor_device_audit_logs_deviceId_createdAt_idx" ON "sensor_device_audit_logs"("deviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "sensor_device_audit_logs" ADD CONSTRAINT "sensor_device_audit_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sensor_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- EnableRowLevelSecurity
-- Hand-added (not Prisma-generated): new tables do not inherit the blanket RLS
-- migration. ENABLE only — never FORCE, which strips the owner exemption
-- Prisma's connection relies on and breaks every query (see
-- 20260731090000_enable_rls_public_tables for the measured failure mode).
ALTER TABLE "zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unknown_sensor_device_ids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sensor_device_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;

-- An ACTIVE device must be assigned. Prisma cannot model CHECK constraints, so
-- this is migration-only (the drift check ignores it). Added last: after the
-- backfill above every ACTIVE row already has org, facility and assignedAt.
ALTER TABLE "sensor_devices" ADD CONSTRAINT "sensor_devices_active_is_assigned"
    CHECK ("state" <> 'ACTIVE' OR ("organizationId" IS NOT NULL AND "facilityId" IS NOT NULL AND "assignedAt" IS NOT NULL));
