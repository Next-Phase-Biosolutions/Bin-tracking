import { describe, expect, it } from 'vitest';
import { tagUrl } from './tag-url';

describe('tagUrl', () => {
    it('builds /app/tap?card=<id> on the given base', () => {
        expect(tagUrl('abc-123', 'https://example.com')).toBe('https://example.com/app/tap?card=abc-123');
    });

    it('tolerates a trailing slash on the base, so the tag never gets a double slash', () => {
        expect(tagUrl('abc', 'https://example.com/')).toBe('https://example.com/app/tap?card=abc');
    });

    it('encodes the card id, so it can never break out of the query string', () => {
        expect(tagUrl('a b&c=d', 'https://example.com')).toBe('https://example.com/app/tap?card=a%20b%26c%3Dd');
    });
});
