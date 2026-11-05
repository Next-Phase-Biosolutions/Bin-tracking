-- AlterEnum
-- Adds the NFC bookkeeping values to AttendanceEventType and MUST contain
-- nothing else. Postgres does not allow ALTER TYPE ... ADD VALUE and any
-- statement that *uses* a new value inside the same transaction, and Prisma
-- wraps each migration in one transaction. Everything that references these
-- values lives in the next migration (nfc_attendance).
ALTER TYPE "AttendanceEventType" ADD VALUE 'DEBOUNCED';
ALTER TYPE "AttendanceEventType" ADD VALUE 'REJECTED';
ALTER TYPE "AttendanceEventType" ADD VALUE 'REGISTERED';
