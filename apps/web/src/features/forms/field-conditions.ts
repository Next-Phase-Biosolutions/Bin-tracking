import type { FormField, StandardSection } from '@bin-tracker/types';

/**
 * Field-level conditional display and date seeding, kept out of
 * StandardFormRenderer so both can be unit-tested without a DOM (apps/web has
 * vitest but no component-testing setup).
 */

/** Local calendar date as `YYYY-MM-DD` — what an `<input type="date">` expects. */
export function todayIso(now: Date = new Date()): string {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().split('T')[0]!;
}

/**
 * Whether a field shows, given the answers filled in so far. Mirrors
 * StandardSection.showIf: no condition means always visible, and an unset
 * watched field matches nothing.
 */
export function isFieldVisible(field: FormField, values: Record<string, string>): boolean {
    if (!field.showIf) return true;
    return field.showIf.values.includes(values[field.showIf.fieldId] ?? '');
}

/**
 * Starting values for a blank form: every `date` field that opted in with
 * `defaultToday` starts at today. Callers skip this when loading a past
 * submission, so a stored date is never overwritten.
 */
export function defaultFieldValues(
    sections: StandardSection[],
    today: string = todayIso(),
): Record<string, string> {
    const values: Record<string, string> = {};
    for (const section of sections) {
        for (const field of section.fields) {
            if (field.defaultToday && field.type === 'date') values[field.id] = today;
        }
    }
    return values;
}
