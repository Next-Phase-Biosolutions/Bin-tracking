-- Push-ingested device readings can be fault-only (no valid temp/humidity), so
-- those two columns become nullable, and the radio/fault/raw fields the device
-- sends get first-class columns. All additive or constraint-relaxing; existing
-- rows are untouched.

-- AlterTable
ALTER TABLE "sensor_readings" ALTER COLUMN "tempC" DROP NOT NULL,
ALTER COLUMN "humidityPct" DROP NOT NULL,
ADD COLUMN     "rssi" DOUBLE PRECISION,
ADD COLUMN     "snr" DOUBLE PRECISION,
ADD COLUMN     "filteredRssi" DOUBLE PRECISION,
ADD COLUMN     "errorCode" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "rawPayload" JSONB;
