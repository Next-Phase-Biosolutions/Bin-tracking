import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 * In Prisma 7, the `url` was removed from schema.prisma datasource.
 * The database URL is now configured here under `datasource.url`.
 * PrismaClient also reads DATABASE_URL from the environment automatically.
 */
export default defineConfig({
    datasource: {
        url: process.env['DATABASE_URL'],
    },
});
