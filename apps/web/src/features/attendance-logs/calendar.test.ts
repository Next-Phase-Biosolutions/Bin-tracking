import { describe, expect, it } from 'vitest';
import { daysInMonth, isFutureDate, isFutureMonth, monthGrid, monthOfDate, parseDate, parseMonth, shiftMonth, toDateString, toMonthString } from './calendar';

describe('monthGrid', () => {
    it('January 2026 starts on a Thursday: four blanks, then 1 to 31, in whole weeks', () => {
        const weeks = monthGrid(2026, 1);

        expect(weeks[0]).toEqual([null, null, null, null, '2026-01-01', '2026-01-02', '2026-01-03']);
        expect(weeks.every((w) => w.length === 7)).toBe(true);
        expect(weeks.flat().filter(Boolean)).toHaveLength(31);
        expect(weeks.at(-1)!.filter(Boolean).at(-1)).toBe('2026-01-31');
    });

    it('a month starting on a Sunday has no leading blanks (February 2026) and fits four weeks', () => {
        const weeks = monthGrid(2026, 2);

        expect(weeks[0]![0]).toBe('2026-02-01');
        expect(weeks).toHaveLength(4);
    });

    it('knows leap years: February 2028 has 29 days, February 2026 and 2100 have 28', () => {
        expect(monthGrid(2028, 2).flat().filter(Boolean)).toHaveLength(29);
        expect(daysInMonth(2026, 2)).toBe(28);
        expect(daysInMonth(2100, 2)).toBe(28);
        expect(daysInMonth(2000, 2)).toBe(29);
    });

    it('a 31-day month starting on Saturday needs six weeks (August 2026)', () => {
        expect(monthGrid(2026, 8)).toHaveLength(6);
        expect(monthGrid(2026, 8)[0]!.slice(0, 6).every((c) => c === null)).toBe(true);
    });

    it('every cell is a real date of that month, in order', () => {
        const dates = monthGrid(2026, 11).flat().filter((d): d is string => Boolean(d));

        expect(dates).toHaveLength(30);
        expect(dates).toEqual([...dates].sort());
        expect(dates.every((d) => d.startsWith('2026-11-'))).toBe(true);
    });
});

describe('parseMonth and parseDate', () => {
    it.each(['2026-01', '2020-12', '2100-06'])('accepts the month %s', (v) => expect(parseMonth(v)).not.toBeNull());
    it.each(['2026-13', '2026-00', '2026-1', '26-01', '', null, undefined, 'abc', '2019-12', '2101-01', '2026-01-14'])('rejects the month %j', (v) => expect(parseMonth(v as never)).toBeNull());

    it('accepts real dates, including a leap day', () => {
        expect(parseDate('2026-01-14')).toEqual({ year: 2026, month: 1, day: 14 });
        expect(parseDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    });

    it.each(['2026-02-30', '2026-02-29', '2026-13-01', '2026-04-31', '2026-1-1', '2026-01-00', '', null, undefined, '2019-01-01', '2026-01-14T00:00'])('rejects the date %j', (v) => expect(parseDate(v as never)).toBeNull());
});

describe('future checks', () => {
    it('a date after today is in the future, today and the past are not', () => {
        expect(isFutureDate('2026-02-11', '2026-02-10')).toBe(true);
        expect(isFutureDate('2026-02-10', '2026-02-10')).toBe(false);
        expect(isFutureDate('2025-12-31', '2026-02-10')).toBe(false);
    });

    it('a month is in the future only if it has not started: the current month is not', () => {
        expect(isFutureMonth(2026, 3, '2026-02-10')).toBe(true);
        expect(isFutureMonth(2026, 2, '2026-02-10')).toBe(false);
        expect(isFutureMonth(2026, 2, '2026-02-01')).toBe(false);
        expect(isFutureMonth(2027, 1, '2026-12-31')).toBe(true);
        expect(isFutureMonth(2026, 12, '2026-12-01')).toBe(false);
    });
});

describe('shiftMonth and string helpers', () => {
    it('rolls the year forwards and backwards', () => {
        expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
        expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
        expect(shiftMonth(2026, 3, 12)).toEqual({ year: 2027, month: 3 });
        expect(shiftMonth(2026, 3, -12)).toEqual({ year: 2025, month: 3 });
        expect(shiftMonth(2026, 1, -13)).toEqual({ year: 2024, month: 12 });
    });

    it('formats and splits dates', () => {
        expect(toDateString(2026, 1, 4)).toBe('2026-01-04');
        expect(toMonthString(2026, 9)).toBe('2026-09');
        expect(monthOfDate('2026-01-14')).toBe('2026-01');
    });
});
