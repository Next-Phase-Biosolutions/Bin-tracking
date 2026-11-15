/**
 * The payroll period ('YYYY-MM') an instant falls in, in an IANA timezone.
 * Payroll buckets a shift by its check-in month in the company's timezone, so
 * this must agree with that bucketing. An unknown timezone falls back to UTC
 * rather than throwing in the middle of an approval.
 */
export function periodOf(date: Date, timeZone: string): string {
    const format = (zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' }).formatToParts(date);
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = format(timeZone);
    } catch {
        parts = format('UTC');
    }
    const get = (type: 'year' | 'month') => parts.find((p) => p.type === type)!.value;
    return `${get('year')}-${get('month')}`;
}

/**
 * The calendar date ('YYYY-MM-DD') an instant falls on, in an IANA timezone. Attendance Logs files a shift under the
 * day the employee CLOCKED IN in the company's timezone (the same rule payroll uses for months), so a 23:30 clock-in
 * in Toronto belongs to that evening, not to the UTC day. An unknown timezone falls back to UTC.
 */
export function localDateOf(date: Date, timeZone: string): string {
    const format = (zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = format(timeZone);
    } catch {
        parts = format('UTC');
    }
    const get = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Whole calendar days from `from` to `to` ('YYYY-MM-DD' both); positive when `to` is later. */
export function dayDiff(from: string, to: string): number {
    const ms = (v: string) => Date.parse(`${v}T00:00:00Z`);
    return Math.round((ms(to) - ms(from)) / 86_400_000);
}
