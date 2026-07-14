import { useMemo, useState } from 'react';
import type { StandardSchema, FormField } from '@bin-tracker/types';
import { FieldInput } from '../FieldComponents';
import {
    SectionRepeatingTable,
    emptyTableRow,
    validateTableRows,
    type TableRow,
} from '../SectionRepeatingTable';

interface Props {
    schema: StandardSchema;
    instructions?: string | null;
    onSubmit: () => void;
    /** Read-only layout preview (import flow); hides submit */
    previewMode?: boolean;
    /** When false, instructions are shown by FormFillLayout instead */
    showInstructions?: boolean;
}

function validateFields(fields: FormField[], values: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const f of fields) {
        if (f.required && !values[f.id]?.trim()) {
            errors[f.id] = 'This field is required';
        }
    }
    return errors;
}

function isVerificationSectionTitle(title: string | null): boolean {
    return (title ?? '').toLowerCase().includes('verification');
}

export function StandardFormRenderer({
    schema,
    instructions,
    onSubmit,
    previewMode,
    showInstructions = true,
}: Props) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const tableSections = useMemo(
        () => schema.sections.filter((s) => s.tableColumns && s.tableColumns.length > 0),
        [schema.sections],
    );

    const [tableRows, setTableRows] = useState<Record<string, TableRow[]>>(() => {
        const init: Record<string, TableRow[]> = {};
        for (const s of tableSections) {
            if (s.tableColumns?.length) {
                init[s.id] = [emptyTableRow(s.tableColumns)];
            }
        }
        return init;
    });

    const setValue = (fieldId: string, value: string) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldId];
                return next;
            });
        }
    };

    const isSectionVisible = (section: StandardSchema['sections'][number]): boolean => {
        if (!section.showIf) return true;
        const current = values[section.showIf.fieldId] ?? '';
        return section.showIf.values.includes(current);
    };

    const handleSubmit = () => {
        const allErrors: Record<string, string> = {};
        for (const section of schema.sections) {
            if (!isSectionVisible(section)) continue;
            Object.assign(allErrors, validateFields(section.fields, values));
            if (section.tableColumns?.length) {
                const rows = tableRows[section.id] ?? [emptyTableRow(section.tableColumns)];
                Object.assign(
                    allErrors,
                    validateTableRows(section.tableColumns, rows, section.id),
                );
            }
        }
        if (Object.keys(allErrors).length > 0) {
            setErrors(allErrors);
            return;
        }
        onSubmit();
    };

    return (
        <div className="flex flex-col gap-6">
            {showInstructions && instructions?.trim() && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800">
                        Instructions
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-amber-900">
                        {instructions}
                    </p>
                </div>
            )}
            {schema.sections.map((section) => {
                if (!isSectionVisible(section)) return null;
                const hasTable = section.tableColumns && section.tableColumns.length > 0;
                const hasFields = section.fields.length > 0;
                if (!hasTable && !hasFields) return null;

                return (
                    <div
                        key={section.id}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                        {section.title && (
                            <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-bold text-[#043F2E]">
                                {section.title}
                            </h3>
                        )}
                        {hasFields && (
                            <div
                                className={
                                    isVerificationSectionTitle(section.title) && section.fields.length <= 6
                                        ? 'mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2'
                                        : 'mb-4 flex flex-col gap-4'
                                }
                            >
                                {section.fields.map((field) => (
                                    <FieldInput
                                        key={field.id}
                                        field={field}
                                        value={values[field.id] ?? ''}
                                        onChange={(v) => setValue(field.id, v)}
                                        error={errors[field.id]}
                                    />
                                ))}
                            </div>
                        )}
                        {hasTable && section.tableColumns && (
                            <SectionRepeatingTable
                                columns={section.tableColumns}
                                rows={tableRows[section.id] ?? [emptyTableRow(section.tableColumns)]}
                                onRowsChange={(rows) =>
                                    setTableRows((prev) => ({ ...prev, [section.id]: rows }))
                                }
                                errors={errors}
                                rowKeyPrefix={section.id}
                                stickyColumnCount={
                                    section.tableColumns.length >= 8 ? 3 : undefined
                                }
                            />
                        )}
                    </div>
                );
            })}

            {!previewMode && (
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#043F2E] py-4 text-lg font-bold text-white shadow-md transition-colors hover:bg-[#032f22]"
                >
                    Submit Form
                </button>
            )}
        </div>
    );
}
