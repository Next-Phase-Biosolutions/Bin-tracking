import type { FormDigitizeDraft } from '@bin-tracker/types';
import { FormFillLayout } from '../FormFillLayout';
import { StandardFormRenderer } from '../renderers/StandardFormRenderer';
import { RepeatingRowFormRenderer } from '../renderers/RepeatingRowFormRenderer';

interface Props {
    draft: FormDigitizeDraft;
    compact?: boolean;
}

function renderFormBody(draft: FormDigitizeDraft) {
    if (draft.schema.formType === 'standard') {
        return (
            <StandardFormRenderer
                schema={draft.schema}
                instructions={draft.description}
                onSubmit={() => {}}
                previewMode
                showInstructions={false}
            />
        );
    }
    if (draft.schema.formType === 'repeating') {
        return <RepeatingRowFormRenderer schema={draft.schema} onSubmit={() => {}} previewMode />;
    }
    return (
        <p className="text-sm text-gray-600">
            Live preview is available for standard and repeating forms. Type: {draft.schema.formType}
        </p>
    );
}

export function FormDraftLivePreview({ draft, compact }: Props) {
    return (
        <div className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-4'}>
            {!compact && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
                    This is how workers will fill the form after you save. Nothing is saved until you
                    tap Save form.
                </div>
            )}
            <div
                className={
                    compact
                        ? 'max-h-[60vh] overflow-y-auto rounded-xl border border-gray-300 shadow-inner'
                        : 'overflow-hidden rounded-xl border border-gray-300 shadow-inner'
                }
            >
                <FormFillLayout
                    title={draft.title}
                    instructions={draft.description}
                    showTitleBar
                >
                    {renderFormBody(draft)}
                </FormFillLayout>
            </div>
        </div>
    );
}
