import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 * In Prisma 7, the `url` was removed from schema.prisma datasource.
 * The database URL is now configured here under `datasource.url`.
 * PrismaClient also reads DATABASE_URL from the environment automatically.
 *
 * Prisma CLI commands (migrate, studio, generate) do not auto-load .env,
 * so load the repo-root .env here. In CI the file is absent and real
 * environment variables are used instead.
 */
try {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
    // .env not present — rely on the ambient environment.
}

export default defineConfig({
    datasource: {
        // Prisma 7 removed `directUrl`. The CLI (migrate, studio) uses this `url`.
        // Use DIRECT_URL (direct Postgres) for Supabase migrations; locally both
        // env vars are typically the same localhost connection string.
        // Runtime queries use DATABASE_URL via the driver adapter in client.ts.
        url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
    },
});
