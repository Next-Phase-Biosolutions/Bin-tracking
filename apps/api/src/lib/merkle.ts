import { createHash } from 'node:crypto';

/**
 * SHA-256 hash of a UTF-8 string, returned as hex.
 */
export function sha256hex(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Build a Merkle root from an array of leaf strings.
 *
 * Rules:
 * - Each leaf is hashed individually first (sha256hex).
 * - Pairs of hashes are combined by concatenation and hashed again.
 * - If the level has an odd number of nodes, the last node is duplicated.
 * - Throws on empty input — caller must ensure there is at least 1 cycle.
 */
export function buildMerkleRoot(leaves: string[]): string {
    if (leaves.length === 0) {
        throw new Error('Cannot build Merkle root: no leaves provided');
    }

    // Hash each leaf
    let level: string[] = leaves.map((leaf) => sha256hex(leaf));

    // Walk up the tree until we reach the root
    while (level.length > 1) {
        const next: string[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i]!;
            // Odd node: pair it with itself (standard Bitcoin-style Merkle)
            const right = i + 1 < level.length ? level[i + 1]! : left;
            next.push(sha256hex(left + right));
        }
        level = next;
    }

    return level[0]!;
}

/**
 * Build a Merkle proof path for a specific leaf index.
 * Returns an ordered array of { hash, position } pairs that a verifier
 * can use to recompute the root without knowing all leaves.
 */
export function buildMerkleProof(
    leaves: string[],
    targetIndex: number,
): Array<{ hash: string; position: 'left' | 'right' }> {
    if (targetIndex < 0 || targetIndex >= leaves.length) {
        throw new Error(`Target index ${targetIndex} out of range`);
    }

    const proof: Array<{ hash: string; position: 'left' | 'right' }> = [];
    let level = leaves.map((leaf) => sha256hex(leaf));
    let idx = targetIndex;

    while (level.length > 1) {
        const next: string[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i]!;
            const right = i + 1 < level.length ? level[i + 1]! : left;

            // If our target is in this pair, record the sibling
            if (i === idx || i + 1 === idx) {
                if (i === idx) {
                    // Our node is on the left — sibling is on the right
                    proof.push({ hash: right, position: 'right' });
                } else {
                    // Our node is on the right — sibling is on the left
                    proof.push({ hash: left, position: 'left' });
                }
            }

            next.push(sha256hex(left + right));
        }

        // Advance index to next level
        idx = Math.floor(idx / 2);
        level = next;
    }

    return proof;
}
