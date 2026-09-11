import type { FormSchema, FormSubmissionValues } from './form.js';

/**
 * A section/group/row is visible only if its `showIf` condition (if any) is
 * satisfied by the currently-known flat values — mirrors
 * StandardFormRenderer's own visibility check (`values[fieldId] ?? ''`
 * against the allowed list) so server-side validation never requires a
 * field the on-screen form itself would have hidden.
 */
function isSectionVisible(showIf: { fieldId: string; values: string[] } | undefined, flatValues: Record<string, string>): boolean {
    if (!showIf) return true;
    const current = flatValues[showIf.fieldId] ?? '';
    return showIf.values.includes(current);
}

/**
 * Returns the labels of every required-but-empty field, respecting
 * `showIf` (a field inside a hidden section is never required) — the one
 * validation both `submit` and `updateSubmission` share, so a form can
 * never be persisted missing data the schema calls mandatory.
 *
 * Only checks what the schema actually marks `required` — ChecklistItem
 * and MatrixRow/MatrixColumn have no `required` flag, so checklist/matrix
 * answers are never required here; only their header/footer fields are.
 * Table rows (standard tableColumns and repeating columns) are validated
 * per existing row, without requiring a minimum row count.
 *
 * A `values.formType` that doesn't match `schema.formType` is treated as
 * "nothing was validly filled" (fails closed) rather than silently
 * skipped — the caller is expected to reject that combination outright,
 * but this function doesn't trust that it already did.
 */
export function getMissingRequiredFields(schema: FormSchema, values: FormSubmissionValues): string[] {
    if (schema.formType !== values.formType) {
        return ['Submitted values do not match this form\'s type'];
    }

    if (schema.formType === 'standard' && values.formType === 'standard') {
        const missing: string[] = [];
        for (const section of schema.sections) {
            if (!isSectionVisible(section.showIf, values.values)) continue;

            for (const field of section.fields) {
                if (field.required && !values.values[field.id]?.trim()) {
                    missing.push(field.label);
                }
            }

            if (section.tableColumns?.length) {
                const rows = values.tableRows[section.id] ?? [];
                for (const row of rows) {
                    for (const col of section.tableColumns) {
                        if (col.required && !row[col.id]?.trim()) {
                            missing.push(col.label);
                        }
                    }
                }
            }
        }
        return missing;
    }

    if (schema.formType === 'checklist' && values.formType === 'checklist') {
        const missing: string[] = [];
        for (const field of schema.headerFields) {
            if (field.required && !values.headerValues[field.id]?.trim()) {
                missing.push(field.label);
            }
        }
        return missing;
    }

    if (schema.formType === 'matrix' && values.formType === 'matrix') {
        const missing: string[] = [];
        for (const field of schema.headerFields) {
            if (field.required && !values.headerValues[field.id]?.trim()) {
                missing.push(field.label);
            }
        }
        for (const field of schema.footerFields ?? []) {
            if (field.required && !values.footerValues[field.id]?.trim()) {
                missing.push(field.label);
            }
        }
        return missing;
    }

    if (schema.formType === 'repeating' && values.formType === 'repeating') {
        const missing: string[] = [];
        for (const row of values.rows) {
            for (const col of schema.columns) {
                if (col.required && !row[col.id]?.trim()) {
                    missing.push(col.label);
                }
            }
        }
        return missing;
    }

    return [];
}
