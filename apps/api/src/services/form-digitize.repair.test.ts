import { describe, expect, it } from 'vitest';
import type { FormDigitizeDraft, StandardSchema } from '@bin-tracker/types';
import {
    isLikelyLivestockForm,
    repairDigitizedDraft,
    LIVESTOCK_MONITORING_COLUMNS,
} from './form-digitize.repair.js';

describe('form-digitize.repair', () => {
    it('detects livestock form by title', () => {
        const draft: FormDigitizeDraft = {
            title: 'Est 183 Feeding and Watering Livestock',
            description: null,
            formType: 'standard',
            schema: { formType: 'standard', sections: [] },
        };
        expect(isLikelyLivestockForm(draft)).toBe(true);
    });

    it('adds missing monitoring columns and converts fields to table', () => {
        const schema: StandardSchema = {
            formType: 'standard',
            sections: [
                {
                    id: 'main',
                    title: null,
                    fields: [
                        { id: 'date', type: 'date', label: 'Date', required: false },
                        { id: 'species', type: 'text', label: 'Species', required: false },
                    ],
                },
            ],
        };
        const draft: FormDigitizeDraft = {
            title: 'Feeding and Watering Livestock',
            description: null,
            formType: 'standard',
            schema,
        };
        const repaired = repairDigitizedDraft(draft);
        const main = (repaired.schema as StandardSchema).sections[0]!;
        expect(main.fields).toHaveLength(0);
        expect(main.tableColumns?.length).toBe(LIVESTOCK_MONITORING_COLUMNS.length);
        expect(repaired.warnings?.length).toBeGreaterThan(0);
    });
});
