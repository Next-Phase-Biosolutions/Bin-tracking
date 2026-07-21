import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptBankField, decryptBankField, last4, resetBankKeyCache } from './bank-crypto.js';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

describe('bank-crypto', () => {
    beforeEach(() => {
        process.env['BANK_DETAILS_KEY'] = KEY;
        resetBankKeyCache();
    });
    afterEach(() => {
        delete process.env['BANK_DETAILS_KEY'];
        resetBankKeyCache();
    });

    it('round-trips a value', () => {
        expect(decryptBankField(encryptBankField('7001234'))).toBe('7001234');
    });

    it('never emits the plaintext in the stored value', () => {
        const stored = encryptBankField('7001234');
        expect(stored).not.toContain('7001234');
        expect(stored.startsWith('v1.')).toBe(true);
    });

    it('produces different ciphertext for the same input (random IV per value)', () => {
        // Two employees at the same bank must not share an institution ciphertext.
        expect(encryptBankField('004')).not.toBe(encryptBankField('004'));
    });

    it('rejects a tampered ciphertext instead of returning garbage', () => {
        const [version, iv, tag, ciphertext] = encryptBankField('7001234').split('.') as [
            string,
            string,
            string,
            string,
        ];
        const flipped = Buffer.from(ciphertext, 'base64url');
        flipped.writeUInt8(flipped.readUInt8(0) ^ 0xff, 0);
        const tampered = [version, iv, tag, flipped.toString('base64url')].join('.');

        expect(() => decryptBankField(tampered)).toThrow(/could not be decrypted/);
    });

    it('rejects a value encrypted under a different key', () => {
        const stored = encryptBankField('7001234');
        process.env['BANK_DETAILS_KEY'] = OTHER_KEY;
        resetBankKeyCache();

        expect(() => decryptBankField(stored)).toThrow(/could not be decrypted/);
    });

    it.each(['', 'plain-digits', 'v1.only.three', 'v2.a.b.c'])('rejects malformed input %j', (bad) => {
        expect(() => decryptBankField(bad)).toThrow(/expected encrypted format/);
    });

    it('throws a configuration error when the key is unset', () => {
        delete process.env['BANK_DETAILS_KEY'];
        resetBankKeyCache();

        expect(() => encryptBankField('7001234')).toThrow(/BANK_DETAILS_KEY not configured/);
    });

    it('rejects a malformed key rather than silently deriving one', () => {
        process.env['BANK_DETAILS_KEY'] = 'too-short';
        resetBankKeyCache();

        expect(() => encryptBankField('7001234')).toThrow(/64 lowercase hex/);
    });

    it('masks to the last four digits', () => {
        expect(last4('7001234')).toBe('1234');
    });
});
