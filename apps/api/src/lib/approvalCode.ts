import { timingSafeEqual } from 'node:crypto';
import { hashToken } from './token.js';

/**
 * Verifies a payroll approval link's one-time code. The code is generated and
 * hashed by the payment-agent repo (src/approval/code.ts) using the same
 * SHA-256 algorithm as hashToken, then stored on the SAME payroll_runs row
 * this reads — the two must stay byte-for-byte compatible.
 */
export function verifyApprovalCode(
    presentedCode: string,
    storedHash: string | null,
    expiresAt: Date | null,
    now: Date = new Date(),
): boolean {
    if (!storedHash || !expiresAt) return false;
    if (now.getTime() > expiresAt.getTime()) return false;
    const presented = Buffer.from(hashToken(presentedCode), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return presented.length === stored.length && timingSafeEqual(presented, stored);
}
