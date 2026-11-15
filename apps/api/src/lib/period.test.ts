import { describe, expect, it } from 'vitest';
import { dayDiff, localDateOf, periodOf } from './period.js';

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

describe('localDateOf', () => {
    it('is the local calendar day in the timezone, not the UTC day', () => {
        const instant = new Date('2026-01-15T04:30:00Z'); // 23:30 on 14 January in Toronto (UTC-5)
        expect(localDateOf(instant, 'UTC')).toBe('2026-01-15');
        expect(localDateOf(instant, 'America/Toronto')).toBe('2026-01-14');
    });

    it('moves forward for zones ahead of UTC', () => {
        expect(localDateOf(new Date('2026-01-14T20:00:00Z'), 'Asia/Tokyo')).toBe('2026-01-15');
    });

    it('follows daylight saving: the day the clocks go forward and the day they go back', () => {
        // Toronto: 8 Mar 2026 02:00 EST -> 03:00 EDT; 1 Nov 2026 02:00 EDT -> 01:00 EST
        expect(localDateOf(new Date('2026-03-08T06:59:00Z'), 'America/Toronto')).toBe('2026-03-08'); // 01:59 EST
        expect(localDateOf(new Date('2026-03-08T07:00:00Z'), 'America/Toronto')).toBe('2026-03-08'); // 03:00 EDT
        expect(localDateOf(new Date('2026-11-01T05:30:00Z'), 'America/Toronto')).toBe('2026-11-01'); // 01:30 EDT
        expect(localDateOf(new Date('2026-11-02T04:59:00Z'), 'America/Toronto')).toBe('2026-11-01'); // 23:59 EST
        expect(localDateOf(new Date('2026-11-02T05:00:00Z'), 'America/Toronto')).toBe('2026-11-02');
    });

    it('handles the year and leap-day boundaries', () => {
        expect(localDateOf(new Date('2027-01-01T04:59:00Z'), 'America/Toronto')).toBe('2026-12-31');
        expect(localDateOf(new Date('2028-02-29T12:00:00Z'), 'America/Toronto')).toBe('2028-02-29');
    });

    it('falls back to UTC for an unknown timezone instead of throwing', () => {
        expect(localDateOf(new Date('2026-01-15T04:30:00Z'), 'Not/AZone')).toBe('2026-01-15');
    });
});

describe('dayDiff', () => {
    it('counts whole calendar days, positive when the second date is later', () => {
        expect(dayDiff('2026-01-14', '2026-01-14')).toBe(0);
        expect(dayDiff('2026-01-14', '2026-01-15')).toBe(1);
        expect(dayDiff('2026-01-15', '2026-01-14')).toBe(-1);
    });

    it('crosses month, year and leap-day boundaries and daylight-saving changes', () => {
        expect(dayDiff('2026-01-31', '2026-02-01')).toBe(1);
        expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
        expect(dayDiff('2028-02-28', '2028-03-01')).toBe(2);
        expect(dayDiff('2026-03-07', '2026-03-09')).toBe(2);
    });
});
