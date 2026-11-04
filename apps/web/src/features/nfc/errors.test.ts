import { describe, expect, it } from 'vitest';
import { TRPCClientError } from '@trpc/client';
import { TAP_ERRORS, appCodeOf, describeAdminError, isOverloadError, isTransientError } from './errors';

const apiError = (appCode: string, httpStatus: number) =>
    TRPCClientError.from({ error: { message: appCode, code: -32000, data: { appCode, httpStatus } } } as never);

describe('appCodeOf', () => {
    it('reads the API machine code, and is undefined for anything else', () => {
        expect(appCodeOf(apiError('NO_SESSION', 401))).toBe('NO_SESSION');
        expect(appCodeOf(new Error('boom'))).toBeUndefined();
        expect(appCodeOf(null)).toBeUndefined();
    });
});

describe('isTransientError', () => {
    it.each([408, 429, 502, 503, 504])('retries HTTP %i', (status) => {
        expect(isTransientError(apiError('SERVER_BUSY', status))).toBe(true);
    });

    it('retries a dropped network and a gateway page with no JSON body', () => {
        expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true);
        expect(isTransientError(new TRPCClientError('Unexpected token < in JSON'))).toBe(true);
    });

    it.each([400, 401, 403, 404, 409])('does not retry a final HTTP %i', (status) => {
        expect(isTransientError(apiError('NO_SESSION', status))).toBe(false);
    });
});

describe('isOverloadError', () => {
    it('is true only for HTTP 429, which the server raises before recording anything', () => {
        expect(isOverloadError(apiError('SERVER_BUSY', 429))).toBe(true);
        expect(isOverloadError(apiError('X', 502))).toBe(false);
        expect(isOverloadError(apiError('X', 504))).toBe(false);
        expect(isOverloadError(new TypeError('Failed to fetch'))).toBe(false);
    });
});

describe('TAP_ERRORS', () => {
    it('has wording for every code the API can return to a phone', () => {
        for (const code of [
            'NO_SESSION', 'SESSION_NOT_FOUND', 'SESSION_REVOKED', 'EMPLOYEE_INACTIVE', 'CARD_INACTIVE', 'CARD_NOT_FOUND',
            'MODULE_DISABLED', 'BAD_ORIGIN', 'SERVER_BUSY', 'TOO_MANY_TAPS', 'UNCONFIRMED', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED', 'TOKEN_SUPERSEDED', 'TOKEN_NOT_FOUND',
        ]) {
            expect(TAP_ERRORS[code], code).toBeDefined();
            expect(TAP_ERRORS[code]!.title.length).toBeGreaterThan(0);
        }
    });

    it('tells an unregistered phone to leave WhatsApp, where the cookie would be lost', () => {
        expect(TAP_ERRORS['NO_SESSION']!.detail).toContain('not inside WhatsApp');
    });
});

describe('describeAdminError', () => {
    it('maps known codes to readable text', () => {
        expect(describeAdminError(apiError('DUPLICATE_CHIP_UID', 409))).toBe('A card with this chip UID already exists.');
        expect(describeAdminError(apiError('OVERLAPS_NEXT_SESSION', 400))).toContain('next shift');
        expect(describeAdminError(apiError('PAYROLL_RUN_FROZEN', 409))).toContain('already approved or paid');
        expect(describeAdminError(apiError('SHIFT_TOO_LONG', 400))).toContain('24 hours');
    });

    it('explains a validation failure, and falls back to the message', () => {
        expect(describeAdminError(apiError('', 400))).toContain('not valid');
        expect(describeAdminError(new Error('plain'))).toBe('plain');
        expect(describeAdminError('???')).toBe('Something went wrong. Please try again.');
    });
});
