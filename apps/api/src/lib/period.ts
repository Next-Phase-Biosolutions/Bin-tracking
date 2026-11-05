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
