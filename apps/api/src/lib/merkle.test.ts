import { describe, it, expect } from 'vitest';
import { sha256hex, buildMerkleRoot, buildMerkleProof } from './merkle.js';

describe('sha256hex', () => {
    it('returns a 64-character hex string', () => {
        const result = sha256hex('hello');
        expect(result).toHaveLength(64);
        expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('is deterministic', () => {
        expect(sha256hex('test')).toBe(sha256hex('test'));
    });

    it('different inputs produce different outputs', () => {
        expect(sha256hex('a')).not.toBe(sha256hex('b'));
    });
});

describe('buildMerkleRoot', () => {
    it('throws on empty input', () => {
        expect(() => buildMerkleRoot([])).toThrow('no leaves provided');
    });

    it('single leaf: root = sha256(leaf)', () => {
        const leaf = 'only-leaf';
        // With a single leaf, the level already has length 1 after hashing.
        // The while-loop never runs, so the root is simply sha256hex(leaf).
        const expected = sha256hex(leaf);
        expect(buildMerkleRoot([leaf])).toBe(expected);
    });

    it('two leaves produced correct combined hash', () => {
        const h0 = sha256hex('leaf-a');
        const h1 = sha256hex('leaf-b');
        const expected = sha256hex(h0 + h1);
        expect(buildMerkleRoot(['leaf-a', 'leaf-b'])).toBe(expected);
    });

    it('is deterministic — same input / same output', () => {
        const leaves = ['cycle-1', 'cycle-2', 'cycle-3'];
        expect(buildMerkleRoot(leaves)).toBe(buildMerkleRoot(leaves));
    });

    it('order matters — different order → different root', () => {
        const a = buildMerkleRoot(['leaf-a', 'leaf-b']);
        const b = buildMerkleRoot(['leaf-b', 'leaf-a']);
        expect(a).not.toBe(b);
    });

    it('handles odd number of leaves', () => {
        expect(() => buildMerkleRoot(['a', 'b', 'c'])).not.toThrow();
    });

    it('handles even number of leaves', () => {
        expect(() => buildMerkleRoot(['a', 'b', 'c', 'd'])).not.toThrow();
    });

    it('handles large input (50 leaves)', () => {
        const leaves = Array.from({ length: 50 }, (_, i) => `cycle-${i}`);
        expect(() => buildMerkleRoot(leaves)).not.toThrow();
        expect(buildMerkleRoot(leaves)).toHaveLength(64);
    });
});

describe('buildMerkleProof', () => {
    it('throws if index out of range', () => {
        expect(() => buildMerkleProof(['a'], 1)).toThrow('out of range');
        expect(() => buildMerkleProof(['a'], -1)).toThrow('out of range');
    });

    it('returns empty proof for single leaf', () => {
        const proof = buildMerkleProof(['only'], 0);
        expect(proof).toHaveLength(0);
    });

    it('proof for two leaves has one element', () => {
        const proof = buildMerkleProof(['a', 'b'], 0);
        expect(proof).toHaveLength(1);
        expect(proof[0]!.position).toBe('right');
    });

    it('a proof can be used to recompute the root', () => {
        const leaves = ['cycle-a', 'cycle-b', 'cycle-c', 'cycle-d'];
        const root = buildMerkleRoot(leaves);
        const proof = buildMerkleProof(leaves, 1); // verify 'cycle-b'

        // Recompute root from leaf + proof
        let computedHash = sha256hex('cycle-b');
        for (const { hash, position } of proof) {
            computedHash =
                position === 'left'
                    ? sha256hex(hash + computedHash)
                    : sha256hex(computedHash + hash);
        }
        expect(computedHash).toBe(root);
    });
});
