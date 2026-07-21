import { describe, expect, it } from 'vitest';
import { VOICE_FILL_REPEATING_KEY, type RepeatingSchema, type StandardSchema } from '@bin-tracker/types';
import {
    flattenCatalog,
    buildKeyterms,
    normalizeVoiceValue,
    mapClaudeResponseToResult,
} from './form-voice-fill.service.js';

const standard: StandardSchema = {
    formType: 'standard',
    sections: [
        {
            id: 'header',
            title: 'Header',
            fields: [
                { id: 'date', type: 'date', label: 'Date', required: false },
                { id: 'species', type: 'select', label: 'Species', required: false, options: ['beef', 'pork'] },
            ],
        },
        {
            id: 'monitoring',
            title: null,
            fields: [],
            tableColumns: [
                { id: 'temp', type: 'number', label: 'Temp', required: false },
                { id: 'ok', type: 'yes_no', label: 'No damage', required: false },
            ],
        },
    ],
};

const repeating: RepeatingSchema = {
    formType: 'repeating',
    columns: [
        { id: 'time', type: 'time', label: 'Time', required: false },
        { id: 'reading', type: 'number', label: 'Reading', required: false },
    ],
};

describe('flattenCatalog', () => {
    it('flattens standard flat fields and table columns with routing metadata', () => {
        const catalog = flattenCatalog(standard);
        expect(catalog.map((e) => e.key)).toEqual(['k0', 'k1', 'k2', 'k3']);
        expect(catalog[0]).toMatchObject({ location: 'field', id: 'date', type: 'date' });
        expect(catalog[2]).toMatchObject({ location: 'table', sectionId: 'monitoring', id: 'temp' });
        expect(catalog[3]).toMatchObject({ location: 'table', sectionId: 'monitoring', id: 'ok' });
    });

    it('keys repeating columns under the repeating sentinel', () => {
        const catalog = flattenCatalog(repeating);
        expect(catalog).toHaveLength(2);
        expect(catalog.every((e) => e.location === 'table' && e.sectionId === VOICE_FILL_REPEATING_KEY)).toBe(true);
    });

    it('returns [] for unsupported form types', () => {
        expect(flattenCatalog({ formType: 'checklist', headerFields: [], groups: [] })).toEqual([]);
    });
});

describe('buildKeyterms', () => {
    it('includes field labels, options, and domain vocab, deduped', () => {
        const terms = buildKeyterms(standard);
        expect(terms).toContain('Species');
        expect(terms).toContain('beef'); // both an option AND domain vocab → appears once
        expect(terms.filter((t) => t === 'beef')).toHaveLength(1);
        expect(terms).toContain('deviation'); // domain vocab
    });
});

describe('normalizeVoiceValue', () => {
    it('maps yes/no synonyms', () => {
        expect(normalizeVoiceValue('yes_no', 'yeah')).toBe('Yes');
        expect(normalizeVoiceValue('yes_no', 'NOPE')).toBe('No');
        expect(normalizeVoiceValue('yes_no', 'maybe')).toBe('maybe');
    });

    it('extracts numeric content', () => {
        expect(normalizeVoiceValue('number', 'about 12 animals')).toBe('12');
        expect(normalizeVoiceValue('number', '3.1 C')).toBe('3.1');
    });

    it('resolves relative dates', () => {
        const today = new Date().toISOString().split('T')[0];
        expect(normalizeVoiceValue('date', 'today')).toBe(today);
        expect(normalizeVoiceValue('date', '2026-07-21')).toBe('2026-07-21');
    });
});

describe('mapClaudeResponseToResult', () => {
    it('routes values into flat fields and one table row, normalizing each', () => {
        const result = mapClaudeResponseToResult(
            standard,
            {
                k0: { value: 'today', confidence: 'high' },
                k1: { value: 'beef', confidence: 'high' },
                k2: { value: '3.1', confidence: 'low' },
                k3: { value: 'yes', confidence: 'high' },
            },
            'the transcript',
        );
        const today = new Date().toISOString().split('T')[0];
        expect(result.fields.date).toEqual({ value: today, confidence: 'high' });
        expect(result.fields.species).toEqual({ value: 'beef', confidence: 'high' });
        expect(result.tableRows.monitoring).toEqual({
            temp: { value: '3.1', confidence: 'low' },
            ok: { value: 'Yes', confidence: 'high' },
        });
        expect(result.transcript).toBe('the transcript');
    });

    it('omits keys that were not returned or were empty, and defaults bad confidence to low', () => {
        const result = mapClaudeResponseToResult(
            standard,
            { k1: { value: '', confidence: 'high' }, k2: { value: '5', confidence: 'bogus' } },
            't',
        );
        expect(result.fields).toEqual({});
        expect(result.tableRows.monitoring).toEqual({ temp: { value: '5', confidence: 'low' } });
    });

    it('routes repeating columns under the repeating key', () => {
        const result = mapClaudeResponseToResult(
            repeating,
            { k0: { value: '09:00', confidence: 'high' }, k1: { value: '7', confidence: 'high' } },
            't',
        );
        expect(result.tableRows[VOICE_FILL_REPEATING_KEY]).toEqual({
            time: { value: '09:00', confidence: 'high' },
            reading: { value: '7', confidence: 'high' },
        });
    });
});
