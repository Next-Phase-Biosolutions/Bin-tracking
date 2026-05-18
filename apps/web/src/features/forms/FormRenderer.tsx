import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { FormTemplate } from '@bin-tracker/types';
import { StandardFormRenderer } from './renderers/StandardFormRenderer';
import { ChecklistFormRenderer } from './renderers/ChecklistFormRenderer';
import { MatrixFormRenderer } from './renderers/MatrixFormRenderer';
import { RepeatingRowFormRenderer } from './renderers/RepeatingRowFormRenderer';
import { FormSuccessScreen } from './FormSuccessScreen';

interface Props {
    form: FormTemplate;
    onBack: () => void;
}

export function FormRenderer({ form, onBack }: Props) {
    const [submitted, setSubmitted] = useState(false);

    if (submitted) {
        return <FormSuccessScreen formTitle={form.title} onBack={onBack} />;
    }

    const renderForm = () => {
        switch (form.schema.formType) {
            case 'standard':
                return <StandardFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
            case 'checklist':
                return <ChecklistFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
            case 'matrix':
                return <MatrixFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
            case 'repeating':
                return <RepeatingRowFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
        }
    };

    const typeLabels: Record<string, string> = {
        standard: 'Multi-Section Form',
        checklist: 'Checklist',
        matrix: 'Matrix / Grid',
        repeating: 'Repeating Table',
    };

    return (
        <div className="min-h-screen bg-[#F5F8F2]">
            {/* Header */}
            <div className="bg-[#043F2E] px-4 pt-10 pb-6">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Forms
                </button>
                <h1 className="text-2xl font-bold text-white leading-tight">{form.title}</h1>
                {form.description && (
                    <p className="text-white/70 text-sm mt-1">{form.description}</p>
                )}
                <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 bg-white/15 text-white rounded-full">
                    {typeLabels[form.schema.formType] ?? form.schema.formType}
                </span>
            </div>

            {/* Form body */}
            <div className="px-4 py-6 max-w-2xl mx-auto pb-12">
                {renderForm()}
            </div>
        </div>
    );
}
