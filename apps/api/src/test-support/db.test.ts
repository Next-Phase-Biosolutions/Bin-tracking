import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbTestsEnabled } from './db.js';

// The guard that keeps the real-Postgres suites away from real data.
describe('dbTestsEnabled', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('allows a throwaway database on this machine', () => {
        expect(dbTestsEnabled('postgresql://u@localhost:5432/bin_tracker_nfc_test?schema=public')).toBe(true);
        expect(dbTestsEnabled('postgresql://postgres:postgres@localhost:5432/bin_tracker_ci?schema=public')).toBe(true);
        expect(dbTestsEnabled('postgresql://u@127.0.0.1:5432/anything_test')).toBe(true);
    });

    it('refuses the dev database even on localhost', () => {
        expect(dbTestsEnabled('postgresql://u@localhost:5432/bin_tracker?schema=public')).toBe(false);
    });

    it('refuses any remote host, even with a _test name', () => {
        expect(dbTestsEnabled('postgresql://u:p@db.supabase.co:5432/bin_tracker_test')).toBe(false);
        expect(dbTestsEnabled('postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres_test')).toBe(false);
        // a host that merely CONTAINS localhost must not pass
        expect(dbTestsEnabled('postgresql://u:p@localhost.evil.example:5432/x_test')).toBe(false);
    });

    it('refuses a missing or unparsable URL', () => {
        // `undefined` falls back to process.env, so unset the real variable explicitly.
        vi.stubEnv('DATABASE_URL', '');
        expect(dbTestsEnabled()).toBe(false);
        expect(dbTestsEnabled('')).toBe(false);
        expect(dbTestsEnabled('not a url')).toBe(false);
    });
});
