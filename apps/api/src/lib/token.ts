import { createHash } from 'node:crypto';

/**
 * SHA-256 hex digest of a bearer credential. Station and invitation tokens
 * are stored HASHED at rest — a DB dump or read-only SQL access must never
 * yield live credentials. The raw value exists only in the moment it's
 * issued (station QR / invite email); every lookup hashes the presented
 * token and matches on the digest. No salt needed: these are high-entropy
 * random values (256-bit / UUIDv4), not passwords.
 */
export function hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
}
