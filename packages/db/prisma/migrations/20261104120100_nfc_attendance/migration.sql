-- NFC tag attendance: cards, phone registration, session approval, and a DB
-- guarantee of one open shift per employee. Additive except for two relaxations
-- of existing constraints (attendance_events.sessionId becomes nullable and its
-- FK becomes ON DELETE SET NULL). Nothing is dropped or rewritten except the
-- one-time duplicate-open-session cleanup below.

-- CreateEnum
CREATE TYPE "NfcDirection" AS ENUM ('IN', 'OUT', 'BOTH');

-- DropForeignKey
ALTER TABLE "attendance_events" DROP CONSTRAINT "attendance_events_sessionId_fkey";

-- AlterTable: events that belong to no shift (REGISTERED, REJECTED while out).
ALTER TABLE "attendance_events" ALTER COLUMN "sessionId" DROP NOT NULL;

-- AlterTable: manager approval of an auto-closed (forgotten check-out) session.
ALTER TABLE "work_sessions" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "nfc_cards" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" "NfcDirection" NOT NULL,
    "chipUid" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfc_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_tokens" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "pendingHash" TEXT,
    "pendingExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nfc_cards_organizationId_idx" ON "nfc_cards"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "nfc_cards_organizationId_chipUid_key" ON "nfc_cards"("organizationId", "chipUid");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_tokenHash_key" ON "registration_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_pendingHash_key" ON "registration_tokens"("pendingHash");

-- CreateIndex
CREATE INDEX "registration_tokens_employeeId_idx" ON "registration_tokens"("employeeId");

-- CreateIndex
CREATE INDEX "registration_tokens_organizationId_idx" ON "registration_tokens"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_sessionTokenHash_key" ON "device_sessions"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "device_sessions_employeeId_idx" ON "device_sessions"("employeeId");

-- CreateIndex
CREATE INDEX "device_sessions_organizationId_idx" ON "device_sessions"("organizationId");

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfc_cards" ADD CONSTRAINT "nfc_cards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, default-deny (no policies): the API connects as the table
-- owner, so it is unaffected. ENABLE only; FORCE would break the owner connection
-- (see 20260731090000_enable_rls_public_tables).
ALTER TABLE "nfc_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_sessions" ENABLE ROW LEVEL SECURITY;

-- One-time cleanup so the unique index below can be created. Until now nothing
-- in the database stopped an employee having two open shifts, and nothing ever
-- closed a forgotten one. For every employee with more than one open session,
-- keep the NEWEST open and auto-close the older ones at the earlier of
-- (check-in + 16 h) and the newest session's check-in, so they never overlap
-- it. They are flagged autoClosed and have no approvedAt, so payroll reports
-- them as AUTO_CLOSED exceptions for a manager to review; they are not paid
-- silently. A no-op when no employee has duplicates.
WITH open_sessions AS (
    SELECT "id", "employeeId", "checkInAt",
           ROW_NUMBER() OVER (PARTITION BY "employeeId" ORDER BY "checkInAt" DESC, "id" DESC) AS rn
    FROM "work_sessions"
    WHERE "checkOutAt" IS NULL
), newest AS (
    SELECT "employeeId", "checkInAt" FROM open_sessions WHERE rn = 1
), closing AS (
    SELECT o."id",
           LEAST(o."checkInAt" + INTERVAL '16 hours', n."checkInAt") AS close_at,
           o."checkInAt"
    FROM open_sessions o
    JOIN newest n ON n."employeeId" = o."employeeId"
    WHERE o.rn > 1
)
UPDATE "work_sessions" ws
SET "checkOutAt" = c.close_at,
    "durationMin" = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (c.close_at - c."checkInAt")) / 60))::int,
    "autoClosed" = true
FROM closing c
WHERE ws."id" = c."id";

-- At most one open shift per employee, enforced by the database. Prisma cannot
-- express a partial index; this is the backstop behind the per-employee lock.
CREATE UNIQUE INDEX "work_sessions_one_open_per_employee"
    ON "work_sessions" ("employeeId")
    WHERE "checkOutAt" IS NULL;
