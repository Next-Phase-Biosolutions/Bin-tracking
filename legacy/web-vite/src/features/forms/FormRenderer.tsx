import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { FormTemplate } from '@bin-tracker/types';
import { StandardFormRenderer } from './renderers/StandardFormRenderer';
import { ChecklistFormRenderer } from './renderers/ChecklistFormRenderer';
import { MatrixFormRenderer } from './renderers/MatrixFormRenderer';
import { RepeatingRowFormRenderer } from './renderers/RepeatingRowFormRenderer';
import { FormSuccessScreen } from './FormSuccessScreen';
import { FormFillLayout } from './FormFillLayout';

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
                return (
                    <StandardFormRenderer
                        schema={form.schema}
                        instructions={form.description}
                        onSubmit={() => setSubmitted(true)}
                        showInstructions={false}
                    />
                );
            case 'checklist':
                return <ChecklistFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
            case 'matrix':
                return <MatrixFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
            case 'repeating':
                return <RepeatingRowFormRenderer schema={form.schema} onSubmit={() => setSubmitted(true)} />;
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F8F2]">
            <div className="bg-[#043F2E] px-4 pt-10 pb-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="mb-3 flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Forms
                </button>
            </div>

            <div className="w-full pb-12">
                <FormFillLayout title={form.title} instructions={form.description}>
                    {renderForm()}
                </FormFillLayout>
            </div>
        </div>
    );
}
