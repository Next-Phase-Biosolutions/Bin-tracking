import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.js';

const VALID_PROD_ENV = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@host:5432/db',
    SUPABASE_URL: 'https://ref.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_JWT_SECRET: 'jwt-secret',
    CORS_ORIGIN: 'https://app.example.com',
    APP_URL: 'https://app.example.com',
} as NodeJS.ProcessEnv;

describe('validateEnv', () => {
    it('passes a complete production environment', () => {
        expect(() => validateEnv(VALID_PROD_ENV)).not.toThrow();
    });

    it('throws in production when a required variable is missing', () => {
        const env = { ...VALID_PROD_ENV };
        delete env['SUPABASE_JWT_SECRET'];
        expect(() => validateEnv(env)).toThrow(/SUPABASE_JWT_SECRET/);
    });

    it('throws in production when DISABLE_AUTH=true is set', () => {
        expect(() => validateEnv({ ...VALID_PROD_ENV, DISABLE_AUTH: 'true' })).toThrow(/DISABLE_AUTH/);
    });

    it('is a no-op outside production even with everything missing', () => {
        expect(() => validateEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow();
        expect(() => validateEnv({} as NodeJS.ProcessEnv)).not.toThrow();
    });
});
