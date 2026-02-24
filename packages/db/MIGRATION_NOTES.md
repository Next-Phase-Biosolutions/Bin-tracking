# Database Migration Notes

## Prisma 7 Upgrade

### Changes Made

1. **Upgraded to Prisma 7.4.0** (from 6.4.1)
   - Updated `@prisma/client` to `^7.4.0`
   - Updated `prisma` CLI to `^7.4.0`

2. **Fixed Critical Schema Issue**
   - **Problem**: The `@@unique([binId, status])` constraint on `bin_cycles` table prevented multiple COMPLETED cycles for the same bin
   - **Impact**: This would have caused the system to fail after the first completed cycle for any bin
   - **Solution**:
     - Removed the flawed `@@unique` constraint
     - Added a **partial unique index** via migration that only applies to ACTIVE and IN_TRANSIT statuses
     - This allows unlimited historical COMPLETED cycles while preventing duplicate active cycles

3. **Added Partial Unique Index**
   - Location: `migrations/20260215000000_add_partial_unique_index/migration.sql`
   - Index name: `bin_cycles_one_active_per_bin`
   - Ensures only ONE active or in-transit cycle per bin at any time
   - Allows unlimited completed cycles (historical records)

### How to Apply Changes

```bash
# 1. Install updated Prisma dependencies
pnpm install

# 2. Generate Prisma Client with new types
pnpm db:generate

# 3. Apply migrations (if database exists)
pnpm db:migrate

# 4. (Optional) Run seed data
pnpm db:seed
```

### What's New in Prisma 7

- **Performance improvements** in query engine
- **Better TypeScript types** for relations
- **Improved error messages**
- **New native database types support**
- **Enhanced connection pooling**

### Testing the Fix

After migration, you should be able to:
1. ✅ Create a bin cycle (status = ACTIVE)
2. ✅ Mark it as picked up (status = IN_TRANSIT)
3. ✅ Complete the cycle (status = COMPLETED)
4. ✅ Create a NEW cycle for the same bin (starts fresh at ACTIVE)
5. ✅ Repeat indefinitely - each bin can have unlimited historical cycles

### Database-Level Protection

The partial unique index provides **database-level protection** against race conditions:
- Even if two requests try to start a bin simultaneously, only one will succeed
- Works in conjunction with application-level serializable transactions
- Prevents data corruption at the lowest level

### Breaking Changes from Prisma 6 to 7

None that affect this project. Prisma 7 is backward compatible with v6 schemas.
