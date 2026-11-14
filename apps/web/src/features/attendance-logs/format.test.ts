import { describe, expect, it } from 'vitest';
import { dayOffsetLabel, formatClock, formatLongDate, formatMinutes, formatShort } from './format';

describe('formatMinutes', () => {
    it.each([[498, '8h 18m'], [480, '8h 00m'], [45, '0h 45m'], [0, '0h 00m'], [960, '16h 00m'], [1471, '24h 31m'], [61, '1h 01m']])('%i minutes is %s', (m, text) => expect(formatMinutes(m)).toBe(text));

    it('never shows a negative or fractional value', () => {
        expect(formatMinutes(-5)).toBe('0h 00m');
        expect(formatMinutes(89.6)).toBe('1h 30m');
    });
});

describe('formatShort', () => {
    it.each([[45, '45m'], [90, '1h 30m'], [120, '2h'], [0, '0m'], [61, '1h 1m']])('%i minutes is %s', (m, text) => expect(formatShort(m)).toBe(text));
});

describe('formatClock', () => {
    const instant = new Date('2026-01-14T13:55:00Z');

    it('shows the time in the COMPANY timezone, whatever the viewer\'s computer uses', () => {
        expect(formatClock(instant, 'America/Toronto')).toMatch(/8:55\s?AM/);
        expect(formatClock(instant, 'UTC')).toMatch(/1:55\s?PM/);
        expect(formatClock(instant, 'Asia/Tokyo')).toMatch(/10:55\s?PM/);
    });

    it('follows daylight saving (the same wall-clock hour in summer is an hour earlier in UTC)', () => {
        expect(formatClock(new Date('2026-07-14T12:55:00Z'), 'America/Toronto')).toMatch(/8:55\s?AM/);
    });

    it('falls back to UTC for an unknown timezone instead of throwing', () => {
        expect(formatClock(instant, 'Not/AZone')).toMatch(/1:55\s?PM/);
    });
});

describe('formatLongDate', () => {
    it('writes the weekday, month and year for a calendar date', () => {
        expect(formatLongDate('2026-01-14')).toBe('Wednesday, January 14, 2026');
        expect(formatLongDate('2028-02-29')).toBe('Tuesday, February 29, 2028');
    });

    it('cannot slip a day with the viewer\'s timezone (it is calendar text, not an instant)', () => {
        expect(formatLongDate('2026-03-08')).toBe('Sunday, March 8, 2026');
        expect(formatLongDate('2026-12-31')).toBe('Thursday, December 31, 2026');
    });
});

describe('dayOffsetLabel', () => {
    it('says nothing for the same day and "+1 day" after midnight', () => {
        expect(dayOffsetLabel(0)).toBe('');
        expect(dayOffsetLabel(1)).toBe('+1 day');
        expect(dayOffsetLabel(2)).toBe('+2 days');
    });
});
