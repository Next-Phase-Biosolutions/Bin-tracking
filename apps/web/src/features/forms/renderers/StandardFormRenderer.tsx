import { useState } from 'react';
import type { StandardSchema, FormField } from '@bin-tracker/types';
import { FieldInput } from '../FieldComponents';

interface Props {
    schema: StandardSchema;
    onSubmit: () => void;
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

export function StandardFormRenderer({ schema, onSubmit }: Props) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const setValue = (fieldId: string, value: string) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
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
        }
        if (Object.keys(allErrors).length > 0) {
            setErrors(allErrors);
            return;
        }
        onSubmit();
    };

    return (
        <div className="flex flex-col gap-6">
            {schema.sections.map((section) => {
                if (!isSectionVisible(section)) return null;
                return (
                    <div key={section.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        {section.title && (
                            <h3 className="text-base font-bold text-[#043F2E] mb-4 pb-2 border-b border-gray-100">
                                {section.title}
                            </h3>
                        )}
                        <div className="flex flex-col gap-4">
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
                    </div>
                );
            })}

            <button
                type="button"
                onClick={handleSubmit}
                className="w-full bg-[#043F2E] hover:bg-[#032f22] text-white py-4 rounded-xl text-lg font-bold transition-colors mt-2"
            >
                Submit Form
            </button>
        </div>
    );
}
