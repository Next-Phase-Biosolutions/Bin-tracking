/** Calendar maths for the Attendance Logs page. Dates are plain 'YYYY-MM-DD' strings, never JS Dates in the browser's zone. */

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
/** The calendar week starts on Sunday (the Canadian convention). */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The first year the page lets you browse back to. */
export const MIN_YEAR = 2020;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export const toDateString = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
export const toMonthString = (year: number, month: number) => `${pad(year, 4)}-${pad(month)}`;

/** Parses 'YYYY-MM' into numbers, or null for anything that is not a real month. */
export function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
    const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    return month >= 1 && month <= 12 && year >= MIN_YEAR && year <= 2100 ? { year, month } : null;
}

/** Parses 'YYYY-MM-DD' into numbers, or null when it is not a real calendar date (so 2026-02-30 is rejected). */
export function parseDate(value: string | null | undefined): { year: number; month: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    if (!m) return null;
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
    const d = new Date(Date.UTC(year, month - 1, day));
    const real = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
    return real && year >= MIN_YEAR && year <= 2100 ? { year, month, day } : null;
}

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Weekday of the 1st of the month, 0 = Sunday. */
const firstWeekday = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

/**
 * The month as weeks of 7 cells (Sunday first). A cell is the date string, or null for the blank days before the 1st
 * and after the last day, so the grid is always rectangular.
 */
export function monthGrid(year: number, month: number): Array<Array<string | null>> {
    const cells: Array<string | null> = Array.from({ length: firstWeekday(year, month) }, () => null);
    for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(toDateString(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: Array<Array<string | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

/** A date after today (compared as text, which is valid for YYYY-MM-DD): nothing can have been clocked there yet. */
export const isFutureDate = (date: string, today: string) => date > today;

/** A whole month that starts after today. */
export const isFutureMonth = (year: number, month: number, today: string) => toDateString(year, month, 1) > today;

/** Moves a (year, month) by whole months, rolling the year. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
    const index = year * 12 + (month - 1) + delta;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The month a date string falls in, as 'YYYY-MM'. */
export const monthOfDate = (date: string) => date.slice(0, 7);
