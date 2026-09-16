import { describe, test, expect } from 'vitest';
import type { FormField, StandardSection } from '@bin-tracker/types';
import { isFieldVisible, defaultFieldValues } from './field-conditions';

const radio = (id: string): FormField => ({ id, type: 'radio', label: id, required: false, options: ['√', 'X'] });
const commentsOn = (id: string, fieldId: string, values: string[]): FormField => ({
    id, type: 'textarea', label: 'Comments', required: false, showIf: { fieldId, values },
});
const section = (id: string, fields: FormField[]): StandardSection => ({ id, title: null, fields });

describe('isFieldVisible', () => {
    test('shows a field that carries no condition', () => {
        expect(isFieldVisible(radio('check_1'), {})).toBe(true);
    });

    test('hides a conditional field while the watched answer is unset', () => {
        expect(isFieldVisible(commentsOn('c1', 'check_1', ['X']), {})).toBe(false);
    });

    test('shows a conditional field once the watched answer matches', () => {
        expect(isFieldVisible(commentsOn('c1', 'check_1', ['X']), { check_1: 'X' })).toBe(true);
    });

    test('hides a conditional field when the watched answer is a different option', () => {
        expect(isFieldVisible(commentsOn('c1', 'check_1', ['X']), { check_1: '√' })).toBe(false);
    });

    test('matches any listed value', () => {
        const field = commentsOn('c1', 'check_1', ['X', 'NIU']);
        expect(isFieldVisible(field, { check_1: 'NIU' })).toBe(true);
    });
});

describe('defaultFieldValues', () => {
    const today = '2026-09-16';

    test('seeds a date field marked defaultToday', () => {
        const fields = [{ id: 'date', type: 'date', label: 'Date', required: false, defaultToday: true } as FormField];
        expect(defaultFieldValues([section('s', fields)], today)).toEqual({ date: today });
    });

    test('leaves other date fields empty', () => {
        const fields = [
            { id: 'date', type: 'date', label: 'Date', required: false, defaultToday: true } as FormField,
            { id: 'planned', type: 'date', label: 'Planned completion', required: false } as FormField,
        ];
        expect(defaultFieldValues([section('s', fields)], today)).toEqual({ date: today });
    });

    test('ignores defaultToday on a field that is not a date', () => {
        const fields = [{ id: 'note', type: 'text', label: 'Note', required: false, defaultToday: true } as FormField];
        expect(defaultFieldValues([section('s', fields)], today)).toEqual({});
    });

    test('collects defaults across every section', () => {
        const a = section('a', [{ id: 'd1', type: 'date', label: 'Date', required: false, defaultToday: true } as FormField]);
        const b = section('b', [{ id: 'd2', type: 'date', label: 'Date', required: false, defaultToday: true } as FormField]);
        expect(defaultFieldValues([a, b], today)).toEqual({ d1: today, d2: today });
    });

    test('returns nothing when no field opts in', () => {
        expect(defaultFieldValues([section('s', [radio('check_1')])], today)).toEqual({});
    });
});
