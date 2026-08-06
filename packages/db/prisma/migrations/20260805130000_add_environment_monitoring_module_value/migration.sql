-- AlterEnum
-- This migration adds the ENVIRONMENT_MONITORING value to the ModuleKey enum
-- and MUST contain nothing else. Postgres does not allow ALTER TYPE ... ADD VALUE
-- and any statement that *uses* the new value inside the same transaction, and
-- Prisma wraps each migration in one transaction. Do everything that references
-- ENVIRONMENT_MONITORING (data backfills, other schema changes, etc.) in a
-- separate, later migration.
ALTER TYPE "ModuleKey" ADD VALUE 'ENVIRONMENT_MONITORING';
