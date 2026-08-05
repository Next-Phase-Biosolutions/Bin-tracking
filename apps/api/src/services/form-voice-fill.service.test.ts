import { describe, expect, it } from 'vitest';
import {
    VOICE_FILL_REPEATING_KEY,
    voiceKeys,
    type ChecklistSchema,
    type MatrixSchema,
    type RepeatingSchema,
    type StandardSchema,
} from '@bin-tracker/types';
import {
    BLANKET_ALL,
    BLANKET_KEY,
    flattenCatalog,
    buildKeyterms,
    expandBlanket,
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

const checklist: ChecklistSchema = {
    formType: 'checklist',
    headerFields: [{ id: 'who', type: 'text', label: 'Person Responsible', required: false }],
    groups: [
        {
            id: 'g1',
            title: 'Equipment',
            items: [
                { id: 'i1', label: 'Corrosion resistant' },
                { id: 'i2', label: 'Free of cracks' },
            ],
        },
    ],
};

const matrix: MatrixSchema = {
    formType: 'matrix',
    headerFields: [{ id: 'supplier', type: 'text', label: 'Supplier Name', required: false }],
    rows: [
        { id: 'peanut', label: 'Peanut' },
        { id: 'milk', label: 'Milk' },
    ],
    columns: [
        { id: 'col_product', label: 'Present in the product' },
        { id: 'col_line', label: 'Present on same line' },
    ],
    footerFields: [{ id: 'procedures', type: 'yes_no', label: 'Procedures in place', required: false }],
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

    it('emits a checklist item as answer + deviation + corrective, blanket only on the answer', () => {
        const catalog = flattenCatalog(checklist);
        expect(catalog.map((e) => e.id)).toEqual([
            'who',
            'i1',
            'i1__deviation',
            'i1__corrective',
            'i2',
            'i2__deviation',
            'i2__corrective',
        ]);
        expect(catalog[1]).toMatchObject({ type: 'yes_no', blanketScope: BLANKET_ALL });
        // Header fields and free text must never be written by a blanket.
        expect(catalog[0]?.blanketScope).toBeUndefined();
        expect(catalog[2]?.blanketScope).toBeUndefined();
    });

    it('scopes each matrix cell blanket to its own column, and covers footer fields', () => {
        const catalog = flattenCatalog(matrix);
        expect(catalog.map((e) => e.id)).toEqual([
            'supplier',
            'peanut__col_product',
            'peanut__col_product__ingredient',
            'peanut__col_line',
            'peanut__col_line__ingredient',
            'milk__col_product',
            'milk__col_product__ingredient',
            'milk__col_line',
            'milk__col_line__ingredient',
            'procedures',
        ]);
        expect(catalog[1]).toMatchObject({ type: 'yes_no', blanketScope: 'col_product' });
        expect(catalog[3]).toMatchObject({ type: 'yes_no', blanketScope: 'col_line' });
        expect(catalog[2]?.blanketScope).toBeUndefined();
    });

    it('leaves standard and repeating slots outside blanket reach', () => {
        expect(flattenCatalog(standard).every((e) => e.blanketScope === undefined)).toBe(true);
        expect(flattenCatalog(repeating).every((e) => e.blanketScope === undefined)).toBe(true);
    });
});

describe('expandBlanket', () => {
    const catalog = flattenCatalog(checklist);

    it('fills nothing when no blanket was spoken', () => {
        const { answers, blanketKeys } = expandBlanket(catalog, { k1: { value: 'No', confidence: 'high' } });
        expect(blanketKeys.size).toBe(0);
        expect(answers).toEqual({ k1: { value: 'No', confidence: 'high' } });
    });

    it('covers only unspoken answer slots, never header or free-text slots', () => {
        const { answers, blanketKeys } = expandBlanket(catalog, {
            k1: { value: 'No', confidence: 'high' },
            [BLANKET_KEY]: { value: 'Yes' },
        });
        // k0=who, k1=i1 (spoken), k2/k3=i1 text, k4=i2, k5/k6=i2 text
        expect([...blanketKeys]).toEqual(['k4']);
        expect(answers.k1).toEqual({ value: 'No', confidence: 'high' });
        expect(answers.k0).toBeUndefined();
        expect(answers.k2).toBeUndefined();
    });

    it('honours a column scope on matrix cells', () => {
        const matrixCatalog = flattenCatalog(matrix);
        const { blanketKeys } = expandBlanket(matrixCatalog, {
            [BLANKET_KEY]: { value: 'No', scope: 'col_product' },
        });
        const filled = matrixCatalog.filter((e) => blanketKeys.has(e.key)).map((e) => e.id);
        expect(filled).toEqual(['peanut__col_product', 'milk__col_product']);
    });

    it('ignores a blanket with no value', () => {
        const { blanketKeys } = expandBlanket(catalog, { [BLANKET_KEY]: { value: '  ' } });
        expect(blanketKeys.size).toBe(0);
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

    it('maps compliance and allergen phrasings', () => {
        expect(normalizeVoiceValue('yes_no', 'compliant')).toBe('Yes');
        expect(normalizeVoiceValue('yes_no', 'Present')).toBe('Yes');
        expect(normalizeVoiceValue('yes_no', 'not present')).toBe('No');
        expect(normalizeVoiceValue('yes_no', 'unsatisfactory')).toBe('No');
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
        expect(result.fields.date).toEqual({ value: today, confidence: 'high', source: 'spoken' });
        expect(result.fields.species).toEqual({ value: 'beef', confidence: 'high', source: 'spoken' });
        expect(result.tableRows.monitoring).toEqual({
            temp: { value: '3.1', confidence: 'low', source: 'spoken' },
            ok: { value: 'Yes', confidence: 'high', source: 'spoken' },
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
        expect(result.tableRows.monitoring).toEqual({
            temp: { value: '5', confidence: 'low', source: 'spoken' },
        });
    });

    it('tags blanket-expanded answers as such and spoken ones as spoken', () => {
        const result = mapClaudeResponseToResult(
            checklist,
            { k4: { value: 'no', confidence: 'high' }, [BLANKET_KEY]: { value: 'yes' } },
            't',
        );
        expect(result.fields[voiceKeys.checklistAnswer('i2')]).toEqual({
            value: 'No',
            confidence: 'high',
            source: 'spoken',
        });
        expect(result.fields[voiceKeys.checklistAnswer('i1')]).toEqual({
            value: 'Yes',
            confidence: 'high',
            source: 'blanket',
        });
    });

    it('refuses an off-vocabulary yes_no value rather than coercing it to the opposite answer', () => {
        // The renderers branch on an exact 'Yes'; anything else would land in
        // the else-arm and mark every item non-compliant / every allergen absent.
        const checklistResult = mapClaudeResponseToResult(
            checklist,
            { [BLANKET_KEY]: { value: 'mostly fine I think' } },
            't',
        );
        expect(checklistResult.fields[voiceKeys.checklistAnswer('i1')]).toBeUndefined();
        expect(checklistResult.fields[voiceKeys.checklistAnswer('i2')]).toBeUndefined();

        const matrixResult = mapClaudeResponseToResult(
            matrix,
            { k1: { value: 'maybe traces', confidence: 'high' } },
            't',
        );
        expect(matrixResult.fields[voiceKeys.matrixCell('peanut', 'col_product')]).toBeUndefined();
    });

    it('accepts a blanket phrased in compliance wording', () => {
        const result = mapClaudeResponseToResult(checklist, { [BLANKET_KEY]: { value: 'compliant' } }, 't');
        expect(result.fields[voiceKeys.checklistAnswer('i1')]).toEqual({
            value: 'Yes',
            confidence: 'high',
            source: 'blanket',
        });
    });

    it('forces a checklist item to No when the speaker described a deviation', () => {
        // Blanket says everything is compliant, but i1 has spoken corrective text.
        const result = mapClaudeResponseToResult(
            checklist,
            {
                k3: { value: 'resurfaced the table', confidence: 'high' },
                [BLANKET_KEY]: { value: 'yes' },
            },
            't',
        );
        expect(result.fields[voiceKeys.checklistAnswer('i1')]).toEqual({
            value: 'No',
            confidence: 'high',
            source: 'spoken',
        });
        expect(result.fields[voiceKeys.checklistCorrective('i1')]?.value).toBe('resurfaced the table');
        // The untouched item still follows the blanket.
        expect(result.fields[voiceKeys.checklistAnswer('i2')]?.value).toBe('Yes');
    });

    it('forces a matrix cell to YES when an ingredient was named', () => {
        const result = mapClaudeResponseToResult(
            matrix,
            {
                k2: { value: 'whey powder', confidence: 'high' },
                [BLANKET_KEY]: { value: 'no', scope: 'col_product' },
            },
            't',
        );
        expect(result.fields[voiceKeys.matrixCell('peanut', 'col_product')]).toEqual({
            value: 'Yes',
            confidence: 'high',
            source: 'spoken',
        });
        expect(result.fields[voiceKeys.matrixCell('milk', 'col_product')]?.value).toBe('No');
        // The other column was out of scope — untouched.
        expect(result.fields[voiceKeys.matrixCell('peanut', 'col_line')]).toBeUndefined();
    });

    it('routes repeating columns under the repeating key', () => {
        const result = mapClaudeResponseToResult(
            repeating,
            { k0: { value: '09:00', confidence: 'high' }, k1: { value: '7', confidence: 'high' } },
            't',
        );
        expect(result.tableRows[VOICE_FILL_REPEATING_KEY]).toEqual({
            time: { value: '09:00', confidence: 'high', source: 'spoken' },
            reading: { value: '7', confidence: 'high', source: 'spoken' },
        });
    });
});
