import { describe, expect, it } from 'vitest';
import { periodOf } from './period.js';

describe('periodOf', () => {
    it('buckets by the local month in the given timezone, not UTC', () => {
        // 01:30 UTC on 1 July is still 21:30 on 30 June in Toronto (UTC-4 in summer).
        const instant = new Date('2031-07-01T01:30:00Z');
        expect(periodOf(instant, 'UTC')).toBe('2031-07');
        expect(periodOf(instant, 'America/Toronto')).toBe('2031-06');
    });

    it('handles the year boundary', () => {
        expect(periodOf(new Date('2031-01-01T02:00:00Z'), 'America/Toronto')).toBe('2030-12');
        expect(periodOf(new Date('2030-12-31T23:30:00Z'), 'Asia/Kolkata')).toBe('2031-01');
    });

    it('falls back to UTC for an unknown timezone instead of throwing', () => {
        expect(periodOf(new Date('2031-07-01T01:30:00Z'), 'Not/AZone')).toBe('2031-07');
    });
});
