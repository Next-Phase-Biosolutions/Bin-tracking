import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/trpc';
import { Icon } from '../../components/ui/Icon';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';

function formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Read for any authenticated org member — same as filling forms in the
 * first place. Editing a submission is gated separately, on the detail
 * page, to org ADMIN only.
 */
export function SubmissionsListPage() {
    const { hasModule, isLoading: modulesLoading } = useSubscription();

    const { data: submissions, isLoading, error } = useQuery({
        queryKey: ['form.listSubmissions'],
        queryFn: () => apiClient.form.listSubmissions.query({}),
        staleTime: 60 * 1000,
    });

    if (modulesLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <FacilityLoader variant="inline" label="submissions" />
            </div>
        );
    }
    if (!hasModule('FORMS')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
                <UpgradePrompt module="FORMS" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-canvas">
            <div className="relative overflow-hidden bg-olive-deep px-4 pb-6 pt-10">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
                <Link to="/app/forms" className="relative mb-4 flex items-center gap-2 text-sm text-bone/70 transition-colors hover:text-bone">
                    <Icon name="arrow" width={15} height={15} className="rotate-180" />
                    Back to Forms
                </Link>
                <h1 className="relative font-display text-2xl font-extrabold text-bone">Submitted Forms</h1>
                <p className="relative mt-1 text-sm text-bone/60">Every form filled out at this org</p>
            </div>

            <div className="mx-auto max-w-2xl px-4 py-6">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <FacilityLoader variant="inline" label="submissions" />
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-3 rounded-2xl border border-rust/30 bg-rust/10 p-5">
                        <Icon name="thermo" width={20} height={20} className="mt-0.5 shrink-0 text-rust" />
                        <div>
                            <p className="text-sm font-semibold text-rust">Could not load submissions</p>
                            <p className="mt-1 text-xs text-rust">{error.message}</p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && submissions?.length === 0 && (
                    <div className="py-20 text-center text-muted">
                        <Icon name="form" width={48} height={48} className="mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No submissions yet</p>
                        <p className="mt-1 text-sm">Filled-out forms will show up here.</p>
                    </div>
                )}

                {submissions && submissions.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {submissions.map((s) => (
                            <Link
                                key={s.id}
                                to={`/app/forms/submissions/${s.id}`}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-edge/70 bg-white p-4 shadow-card transition-shadow hover:shadow-panel-sm"
                            >
                                <div>
                                    <p className="font-display text-sm font-bold text-olive-deep">{s.formTitle}</p>
                                    <p className="mt-0.5 text-xs text-muted">
                                        {s.submittedByName ?? '—'} · {formatDate(s.createdAt)}
                                    </p>
                                </div>
                                <Icon name="arrow" width={14} height={14} className="shrink-0 text-muted" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SubmissionsListPage;
