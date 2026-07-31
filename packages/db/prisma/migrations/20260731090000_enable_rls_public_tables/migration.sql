-- Enable Row Level Security on every bin-tracker-owned table in `public`.
--
-- WHY
-- Supabase publishes every `public` table over PostgREST, authorized by the
-- anon key that apps/web/src/lib/supabase.ts ships into the browser bundle.
-- That key is public by design. With RLS off, anyone who reads it out of the
-- JS bundle can GET/POST https://<ref>.supabase.co/rest/v1/<table> and read or
-- write every row of every organization — payroll audit logs, invitation
-- tokens, org membership — bypassing tRPC auth and the org-tenancy checks
-- entirely. This is the CRITICAL "RLS Disabled in Public" advisor finding.
--
-- The app never uses PostgREST: the browser client only calls `supabase.auth.*`
-- (auth schema, unaffected), the seed script only calls `/auth/v1/admin/*`, and
-- all data access goes through Prisma over a direct Postgres connection.
-- Denying PostgREST wholesale therefore costs the application nothing.
--
-- NO POLICIES ARE CREATED, ON PURPOSE
-- RLS with zero policies is default-deny for `anon`/`authenticated`, while the
-- table OWNER stays exempt. Prisma connects as `postgres`, which owns every
-- table created by these migrations, so every existing query keeps working
-- unchanged. Verified empirically against a NOSUPERUSER/NOBYPASSRLS owner:
-- SELECT/INSERT/UPDATE/DELETE all succeed for the owner, while a granted
-- non-owner role gets 0 rows and "violates row-level security policy".
--
-- NEVER ADD `FORCE ROW LEVEL SECURITY`
-- FORCE strips the owner exemption. Applying it here makes every Prisma read
-- return zero rows and takes the entire application down. Measured, not
-- assumed. If a future change genuinely needs FORCE, it must ship real
-- policies for the `postgres` role first.
--
-- OWNERSHIP GUARD
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` requires ownership and errors
-- with "must be owner of table" otherwise, which would abort this migration
-- and block the deploy. `zum_payees` belongs to the payout side of the shared
-- Supabase project (see docs/payout-bank-details-contract.md §5 — bin-tracker
-- never reads or writes it), so tables this role does not own are skipped
-- rather than assumed. Enabling RLS on that table is the payout side's call,
-- not ours.
--
-- Idempotent: skips tables that already have RLS, so re-runs are a no-op and
-- it is safe against a database where some tables were fixed by hand.
DO $$
DECLARE
  t record;
  enabled_count int := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'              -- ordinary tables only; views/sequences have no RLS
      AND NOT c.relrowsecurity         -- idempotency: skip what is already protected
      -- ownership, honouring role membership the same way Postgres does
      AND pg_has_role(current_user, c.relowner, 'USAGE')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    enabled_count := enabled_count + 1;
    RAISE NOTICE 'RLS enabled: public.%', t.relname;
  END LOOP;

  RAISE NOTICE 'RLS enabled on % table(s).', enabled_count;

  -- Surface anything left exposed (e.g. a table owned by another role) so it
  -- is visible in deploy logs instead of silently remaining world-readable.
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    RAISE WARNING 'RLS still DISABLED (not owned by %): public.%', current_user, t.relname;
  END LOOP;
END $$;
