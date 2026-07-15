-- Task 25, Phase B: every organization_members row now has a role from the
-- backfill in the previous migration — enforce NOT NULL going forward so a
-- new membership can never be created (via provisionOrganization or invitation
-- acceptance) without an explicit role.

-- AlterTable
ALTER TABLE "organization_members" ALTER COLUMN "role" SET NOT NULL;
