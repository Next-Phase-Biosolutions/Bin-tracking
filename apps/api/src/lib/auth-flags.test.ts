import { describe, it, expect, afterEach } from 'vitest';
import { isAuthDisabled } from './auth-flags.js';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe('isAuthDisabled', () => {
    it('returns true when DISABLE_AUTH=true outside production', () => {
        process.env['DISABLE_AUTH'] = 'true';
        process.env['NODE_ENV'] = 'development';
        expect(isAuthDisabled()).toBe(true);
    });

    it('returns false in production even when DISABLE_AUTH=true', () => {
        process.env['DISABLE_AUTH'] = 'true';
        process.env['NODE_ENV'] = 'production';
        expect(isAuthDisabled()).toBe(false);
    });

    it('returns false when DISABLE_AUTH is unset', () => {
        delete process.env['DISABLE_AUTH'];
        process.env['NODE_ENV'] = 'development';
        expect(isAuthDisabled()).toBe(false);
    });
});
