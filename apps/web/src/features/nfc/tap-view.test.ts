import { describe, expect, it } from 'vitest';
import { formatDuration, toTapView, type TapResult } from './tap-view';

const at = new Date('2031-03-03T14:05:00');
const base = { at, employeeName: 'Jane Doe', debounced: false };

describe('formatDuration', () => {
    it.each([
        [0, '0m'], [45, '45m'], [60, '1h'], [489, '8h 9m'], [960, '16h'],
    ])('%i min -> %s', (min, text) => expect(formatDuration(min)).toBe(text));
});

describe('toTapView', () => {
    it('welcomes a check-in with the name', () => {
        expect(toTapView({ ...base, status: 'CHECK_IN' })).toMatchObject({ tone: 'in', detail: 'Jane Doe' });
    });

    it('shows hours worked on a check-out', () => {
        const view = toTapView({ ...base, status: 'CHECK_OUT', durationMin: 489 });
        expect(view).toMatchObject({ tone: 'out' });
        expect(view.detail).toBe('Worked 8h 9m · Jane Doe');
    });

    it('tells the employee which card to use when a mismatch is returned', () => {
        expect(toTapView({ ...base, status: 'ALREADY_CHECKED_IN', since: at }).detail).toContain('Tap the OUT card');
        expect(toTapView({ ...base, status: 'NOT_CHECKED_IN' }).detail).toContain('Tap the IN card');
    });

    it('confirms registration', () => {
        expect(toTapView({ ...base, status: 'REGISTRATION_COMPLETE' })).toMatchObject({ tone: 'registered', title: 'Phone registered!' });
    });

    it('renders a double-tap echo identically to the original result', () => {
        const original: TapResult = { ...base, status: 'CHECK_IN' };
        expect(toTapView({ ...original, debounced: true })).toEqual(toTapView(original));
    });
});
