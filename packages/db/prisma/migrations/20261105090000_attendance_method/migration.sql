-- Which clock-in method an organization uses: NFC tag taps (default) or the
-- original QR badge scan. Additive: one new enum type and one NOT NULL column
-- with a default, so existing rows are filled with 'NFC' in the same statement
-- and nothing is rewritten or dropped. Flipping an org back to 'QR' is the
-- rollback for the NFC rollout.
CREATE TYPE "AttendanceMethod" AS ENUM ('NFC', 'QR');

ALTER TABLE "settings" ADD COLUMN "attendanceMethod" "AttendanceMethod" NOT NULL DEFAULT 'NFC';
