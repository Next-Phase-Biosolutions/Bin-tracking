-- Task 25: close the invitation privilege-escalation hole — role must live
-- on the per-org OrganizationMember row, not just globally on User.
--
-- Phase A of the additive-migration pattern (see 20260714060613_org_layer_additive
-- / 20260714062541_org_layer_enforce for the established precedent): add the
-- column nullable first, backfill every existing row, then a second migration
-- enforces NOT NULL. Both migrations ship together in this commit — there is
-- no live production data yet (see kvmplan.md / Task 23), so there is no
-- deploy window where a NOT NULL constraint could be applied before the
-- backfill runs.

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN "role" "UserRole";

-- Backfill: every existing membership gets its user's current GLOBAL role.
-- This does not grant anything more permissive than what already existed —
-- it makes today's already-effective access level explicit and per-membership
-- going forward. Idempotent / re-runnable: only touches rows where role IS
-- NULL, so running this statement again is a no-op.
UPDATE "organization_members" AS om
SET "role" = u."role"
FROM "users" AS u
WHERE om."userId" = u."id" AND om."role" IS NULL;
