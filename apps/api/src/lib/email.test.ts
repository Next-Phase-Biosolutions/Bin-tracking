import { describe, it, expect } from 'vitest';
import { escapeHtml } from './email.js';

describe('escapeHtml', () => {
    it('escapes HTML-significant characters', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('escapes ampersands, quotes, and apostrophes', () => {
        expect(escapeHtml(`Tom & Jerry's "Org"`)).toBe('Tom &amp; Jerry&#39;s &quot;Org&quot;');
    });

    it('leaves plain text unchanged', () => {
        expect(escapeHtml('Acme Processing Co.')).toBe('Acme Processing Co.');
    });
});
