-- Station + invitation tokens are now stored as SHA-256 hex digests
-- (apps/api/src/lib/token.ts) so a DB dump never yields live credentials.
-- Hash every existing plaintext token in place: incoming raw tokens are
-- hashed before lookup, so already-issued station tokens keep working.
-- sha256() is a Postgres core function (PG11+) — no pgcrypto needed.
-- Idempotence note: a 64-char lowercase-hex token that was ALREADY a digest
-- would be double-hashed if this ran twice, but Prisma migrations run
-- exactly once per database.
UPDATE "stations" SET "token" = encode(sha256("token"::bytea), 'hex');
UPDATE "invitations" SET "token" = encode(sha256("token"::bytea), 'hex');
