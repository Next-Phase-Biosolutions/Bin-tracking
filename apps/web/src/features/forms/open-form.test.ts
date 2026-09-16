import { describe, test, expect } from 'vitest';
import type { FormTemplate } from '@bin-tracker/types';
import { resolveOpenForm } from './open-form';

const form = (id: string): FormTemplate => ({
    id, title: `Form ${id}`, description: null, stage: 'KILL_FLOOR', formType: 'standard',
    schema: { formType: 'standard', sections: [] }, sourceImageUrl: null, triggerType: null,
    triggerConfig: null, fillFrequency: null, isActive: true, sortOrder: 0,
    createdAt: new Date(), updatedAt: new Date(),
});
const forms = [form('a'), form('b')];

describe('resolveOpenForm', () => {
    test('opens the form named in the url', () => {
        expect(resolveOpenForm(forms, 'b')?.id).toBe('b');
    });

    test('opens nothing when the url carries no form id', () => {
        expect(resolveOpenForm(forms, undefined)).toBeNull();
    });

    test('opens nothing for a form id that is not in the list', () => {
        expect(resolveOpenForm(forms, 'deleted-form')).toBeNull();
    });

    test('opens nothing while the list is still loading', () => {
        expect(resolveOpenForm(undefined, 'b')).toBeNull();
    });
});
