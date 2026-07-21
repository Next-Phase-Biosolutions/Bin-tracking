import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption for employee bank details (R7).
 *
 * These columns are bank PII: a DB dump, a read-only SQL session, or a stolen
 * backup must not yield numbers that can move money. AES-256-GCM (not CBC) so
 * tampering is detected rather than silently decrypting to garbage that then
 * gets wired somewhere.
 *
 * Stored format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url.
 * - The version prefix makes key rotation possible later without guessing at
 *   which values are old (add a `v2` writer, keep the `v1` reader).
 * - A fresh random 12-byte IV per value — never derived, never reused — so two
 *   employees at the same bank don't produce identical ciphertext for the same
 *   institution number.
 *
 * The payout agent (separate repo, read-only on `employees`) must implement the
 * matching decrypt against this exact format — see
 * docs/payout-bank-details-contract.md.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard; 96-bit IVs are used directly, not re-hashed
const KEY_HEX_LENGTH = 64; // 32 bytes

let _key: Buffer | null = null;

/**
 * Lazy key resolution, matching this codebase's other env-gated integrations
 * (lib/email.ts, lib/stripe.ts): the server must boot cleanly with
 * BANK_DETAILS_KEY unset, since payouts are one feature among many and a
 * missing key must not take down attendance, forms, or shipments. Callers hit
 * a clear error only when they actually touch bank data.
 */
function getKey(): Buffer {
    if (_key) return _key;

    const raw = process.env['BANK_DETAILS_KEY'];
    if (!raw) {
        throw new Error(
            'BANK_DETAILS_KEY not configured — set it (openssl rand -hex 32) before handling employee bank details',
        );
    }
    if (!/^[0-9a-f]{64}$/.test(raw)) {
        throw new Error(
            `BANK_DETAILS_KEY must be ${KEY_HEX_LENGTH} lowercase hex characters (32 bytes) — generate with: openssl rand -hex 32`,
        );
    }

    _key = Buffer.from(raw, 'hex');
    return _key;
}

/** Test-only: drop the memoized key so a test can swap BANK_DETAILS_KEY. */
export function resetBankKeyCache(): void {
    _key = null;
}

/**
 * Encrypts one bank field. Throws only on missing/invalid key configuration —
 * and never with the plaintext in the message, since these errors are logged
 * and reported to Sentry.
 */
export function encryptBankField(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/**
 * Decrypts one bank field. Any malformed input, unknown version, or failed
 * auth-tag check throws a generic error — the caller (payout / admin tooling)
 * should treat that as "details unusable, hold this payout", never as a value
 * to partially trust.
 */
export function decryptBankField(stored: string): string {
    const parts = stored.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error('Bank field is not in the expected encrypted format');
    }

    const [, ivPart, tagPart, ciphertextPart] = parts as [string, string, string, string];

    try {
        const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
        return Buffer.concat([
            decipher.update(Buffer.from(ciphertextPart, 'base64url')),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        // Swallow the underlying crypto error deliberately: it can carry
        // fragments of the value, and the only actionable fact is that this
        // field cannot be trusted.
        throw new Error('Bank field could not be decrypted — wrong key or tampered value');
    }
}

/** Last 4 digits, for the `****1234` display mask. Stored plain; alone it cannot move money. */
export function last4(accountNumber: string): string {
    return accountNumber.slice(-4);
}
