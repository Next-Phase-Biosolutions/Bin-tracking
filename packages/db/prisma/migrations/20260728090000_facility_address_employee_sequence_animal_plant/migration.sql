-- Facility: swap Latitude/Longitude for a structured address breakdown.
-- Nullable by design: existing facilities have no city/province/postal/country
-- data yet; the create/edit form requires them going forward (facility.schema.ts).
ALTER TABLE "facilities" DROP COLUMN "lat";
ALTER TABLE "facilities" DROP COLUMN "lng";
ALTER TABLE "facilities" ADD COLUMN "city" TEXT;
ALTER TABLE "facilities" ADD COLUMN "province" TEXT;
ALTER TABLE "facilities" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "facilities" ADD COLUMN "country" TEXT;

-- Organization: forward-only counter backing Employee.employeeCode
-- (EMP-000001, EMP-000002, ...). Existing employees keep their old random
-- codes; this counter only applies to employees registered from now on.
ALTER TABLE "organizations" ADD COLUMN "employeeCounter" INTEGER NOT NULL DEFAULT 0;

-- AnimalRegistration: "Owner Name" becomes "Plant ID" (same column, new
-- meaning/format enforced at the API layer, not the DB).
ALTER TABLE "animal_registrations" RENAME COLUMN "ownerName" TO "plantId";

-- AnimalRegistration: new "Employee Received" link. Nullable in DB for
-- pre-existing rows (recorded before this field existed); required by the
-- form going forward (farmer.schema.ts).
ALTER TABLE "animal_registrations" ADD COLUMN "employeeId" TEXT;

CREATE INDEX "animal_registrations_employeeId_idx" ON "animal_registrations"("employeeId");

ALTER TABLE "animal_registrations" ADD CONSTRAINT "animal_registrations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
