-- Which facility-zone page a device appears on. Replaces the frontend-only
-- VITE_ZONE_SENSOR_WETAGING env var, which could name exactly one device
-- globally and so could not serve more than one tenant. Nullable and additive;
-- existing devices keep zone = NULL (registered, but on no zone page).

-- AlterTable
ALTER TABLE "sensor_devices" ADD COLUMN     "zone" TEXT;
