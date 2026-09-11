import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormSubmissionValues } from '@bin-tracker/types';
import { apiClient } from '../../lib/trpc';
import { Icon } from '../../components/ui/Icon';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { StandardFormRenderer } from './renderers/StandardFormRenderer';
import { ChecklistFormRenderer } from './renderers/ChecklistFormRenderer';
import { MatrixFormRenderer } from './renderers/MatrixFormRenderer';
import { RepeatingRowFormRenderer } from './renderers/RepeatingRowFormRenderer';

function formatDateTime(d: Date | string): string {
    return new Date(d).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * Read for any authenticated org member. Editing is admin-only
 * (updateSubmission is gated by orgAdminProcedure server-side too — this
 * hides the button, it doesn't replace that check) and always leaves an
 * audit trail, shown below the form.
 */
export function SubmissionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [editing, setEditing] = useState(false);
    /**
     * Remount key for the renderer. Each renderer seeds its local state from
     * `initialValues` ONCE, in a lazy useState initializer that never re-runs
     * on prop changes — so without forcing a remount, Cancel only flipped the
     * inputs back to disabled while they still displayed the abandoned edit,
     * and re-entering Edit resumed from that never-saved value. Bumped on
     * every transition so both Edit and Cancel start from the saved record.
     */
    const [formKey, setFormKey] = useState(0);
    const queryClient = useQueryClient();

    const beginEdit = () => {
        setFormKey((k) => k + 1);
        setEditing(true);
    };
    const cancelEdit = () => {
        setFormKey((k) => k + 1);
        setEditing(false);
    };

    const { data: me } = useQuery({
        queryKey: ['auth.me'],
        queryFn: () => apiClient.auth.me.query(),
    });

    const { data: detail, isLoading, error } = useQuery({
        queryKey: ['form.getSubmission', id],
        queryFn: () => apiClient.form.getSubmission.query({ id: id! }),
        enabled: Boolean(id),
    });

    const updateMutation = useMutation({
        mutationFn: (values: FormSubmissionValues) =>
            apiClient.form.updateSubmission.mutate({ id: id!, values }),
        onSuccess: () => {
            setFormKey((k) => k + 1);
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['form.getSubmission', id] });
        },
    });

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <FacilityLoader variant="inline" label="submission" />
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-10">
                <div className="flex items-start gap-3 rounded-2xl border border-rust/30 bg-rust/10 p-5">
                    <Icon name="thermo" width={20} height={20} className="mt-0.5 shrink-0 text-rust" />
                    <div>
                        <p className="text-sm font-semibold text-rust">Could not load this submission</p>
                        <p className="mt-1 text-xs text-rust">{error?.message ?? 'Not found'}</p>
                    </div>
                </div>
            </div>
        );
    }

    const { submission, formTitle, formSchema, submittedByName, auditLogs } = detail;
    const isAdmin = me?.orgRole === 'ADMIN';
    const readOnly = !editing;

    const renderFormReadOnlyOrEdit = () => {
        const values = submission.values;
        const onSubmit = (v: FormSubmissionValues) => updateMutation.mutate(v);

        if (formSchema.formType === 'standard' && values.formType === 'standard') {
            return (
                <StandardFormRenderer
                    key={formKey}
                    schema={formSchema}
                    onSubmit={onSubmit}
                    initialValues={values}
                    readOnly={readOnly}
                    showInstructions={false}
                />
            );
        }
        if (formSchema.formType === 'checklist' && values.formType === 'checklist') {
            return (
                <ChecklistFormRenderer key={formKey} schema={formSchema} onSubmit={onSubmit} initialValues={values} readOnly={readOnly} />
            );
        }
        if (formSchema.formType === 'matrix' && values.formType === 'matrix') {
            return (
                <MatrixFormRenderer key={formKey} schema={formSchema} onSubmit={onSubmit} initialValues={values} readOnly={readOnly} />
            );
        }
        if (formSchema.formType === 'repeating' && values.formType === 'repeating') {
            return (
                <RepeatingRowFormRenderer key={formKey} schema={formSchema} onSubmit={onSubmit} initialValues={values} readOnly={readOnly} />
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-canvas">
            <div className="relative overflow-hidden bg-olive-deep px-4 pb-6 pt-10">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
                <Link
                    to="/app/forms/submissions"
                    className="relative mb-4 flex items-center gap-2 text-sm text-bone/70 transition-colors hover:text-bone"
                >
                    <Icon name="arrow" width={15} height={15} className="rotate-180" />
                    Back to Submissions
                </Link>
                <div className="relative flex items-end justify-between gap-3">
                    <div>
                        <h1 className="font-display text-2xl font-extrabold text-bone">{formTitle}</h1>
                        <p className="mt-1 text-sm text-bone/60">
                            {submittedByName ?? '—'} · {formatDateTime(submission.createdAt)}
                        </p>
                    </div>
                    {isAdmin && !editing && (
                        <button
                            type="button"
                            onClick={beginEdit}
                            className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-olive-deep transition-colors hover:bg-bone-light"
                        >
                            Edit
                        </button>
                    )}
                    {editing && (
                        <button
                            type="button"
                            onClick={cancelEdit}
                            className="shrink-0 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-bone transition-colors hover:bg-white/25"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-3xl px-4 py-6">
                {updateMutation.isError && (
                    <p role="alert" className="mb-4 rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                        {updateMutation.error.message}
                    </p>
                )}

                {/* Native fieldset-disable blocks the renderer's own Save button
                    while the correction is in flight — same double-submit guard
                    FormRenderer uses for the create path. */}
                <fieldset disabled={updateMutation.isPending} className="border-0 p-0 m-0">
                    {renderFormReadOnlyOrEdit()}
                </fieldset>

                {auditLogs.length > 0 && (
                    <div className="mt-8 rounded-2xl border border-edge bg-bone-light p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-olive-deep">
                            Correction history
                        </p>
                        <ul className="flex flex-col gap-1 text-xs text-muted">
                            {auditLogs.map((log) => (
                                <li key={log.id}>Edited {formatDateTime(log.createdAt)}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SubmissionDetailPage;
