-- Employee EFT payout details, read by the payroll payout agent (separate
-- repo, read-only on this table) to send direct deposits via Zum Rails.
--
-- All columns nullable by design: an employee must be able to exist before
-- submitting banking, and the payout agent treats missing details as HELD —
-- withheld for review, never a failed or partial payment. Adding required
-- columns here would block employee registration.
--
-- The four PII values hold AES-256-GCM ciphertext ("v1.<iv>.<tag>.<ct>",
-- apps/api/src/lib/bank-crypto.ts), never plaintext digits.
ALTER TABLE "employees"
    ADD COLUMN "bankInstitution"   TEXT,
    ADD COLUMN "bankTransit"       TEXT,
    ADD COLUMN "bankAccount"       TEXT,
    ADD COLUMN "accountHolderName" TEXT,
    ADD COLUMN "accountType"       TEXT,
    ADD COLUMN "bankAccountLast4"  TEXT,
    ADD COLUMN "bankDetailsAt"     TIMESTAMP(3),
    ADD COLUMN "bankLinkToken"     TEXT,
    ADD COLUMN "bankLinkExpiresAt" TIMESTAMP(3);

-- Lookup key for the self-serve bank-details link. Stores a SHA-256 digest
-- (lib/token.ts), never the raw token. Nullable + UNIQUE is safe in Postgres:
-- NULLs are not considered equal, so every employee without a live link keeps
-- its own NULL.
CREATE UNIQUE INDEX "employees_bankLinkToken_key" ON "employees"("bankLinkToken");

-- Owned by the payroll payout agent, which already created it in the shared
-- Supabase project. Declared in schema.prisma so Prisma stops reporting it as
-- drift; IF NOT EXISTS so `migrate deploy` is a no-op there while still
-- producing a correct fresh dev/CI database.
CREATE TABLE IF NOT EXISTS "zum_payees" (
    "employeeId" TEXT NOT NULL,
    "zumUserId"  TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zum_payees_pkey" PRIMARY KEY ("employeeId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "zum_payees_zumUserId_key" ON "zum_payees"("zumUserId");
