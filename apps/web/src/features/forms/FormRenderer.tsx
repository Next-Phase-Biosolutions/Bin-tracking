import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import type { FormTemplate, FormSubmissionValues } from '@bin-tracker/types';
import { apiClient } from '../../lib/trpc';
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

    const submitMutation = useMutation({
        mutationFn: (values: FormSubmissionValues) =>
            apiClient.form.submit.mutate({ formId: form.id, values }),
        onSuccess: () => setSubmitted(true),
    });

    if (submitted) {
        return <FormSuccessScreen formTitle={form.title} onBack={onBack} />;
    }

    const handleSubmit = (values: FormSubmissionValues) => submitMutation.mutate(values);

    const renderForm = () => {
        switch (form.schema.formType) {
            case 'standard':
                return (
                    <StandardFormRenderer
                        schema={form.schema}
                        instructions={form.description}
                        onSubmit={handleSubmit}
                        formId={form.id}
                        showInstructions={false}
                    />
                );
            case 'checklist':
                return <ChecklistFormRenderer schema={form.schema} onSubmit={handleSubmit} formId={form.id} />;
            case 'matrix':
                return <MatrixFormRenderer schema={form.schema} onSubmit={handleSubmit} formId={form.id} />;
            case 'repeating':
                return <RepeatingRowFormRenderer schema={form.schema} onSubmit={handleSubmit} formId={form.id} />;
        }
    };

    return (
        <div className="min-h-screen bg-canvas">
            <div className="bg-olive-deep px-4 pt-10 pb-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="mb-3 flex items-center gap-2 text-sm text-bone/70 transition-colors hover:text-bone"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Forms
                </button>
            </div>

            <div className="w-full pb-12">
                <FormFillLayout title={form.title} instructions={form.description}>
                    <div className="flex flex-col gap-6">
                        {submitMutation.isError && (
                            <p role="alert" className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                                {submitMutation.error.message}
                            </p>
                        )}
                        {/* Native fieldset-disable blocks every descendant control (including the
                            renderers' own Submit buttons) while the mutation is in flight — cheaper
                            than threading an isSubmitting prop through all four renderer components. */}
                        <fieldset disabled={submitMutation.isPending}>{renderForm()}</fieldset>
                    </div>
                </FormFillLayout>
            </div>
        </div>
    );
}
