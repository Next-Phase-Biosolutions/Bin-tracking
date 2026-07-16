import type { ReactNode } from 'react';
import type { ModuleKey } from '@bin-tracker/types';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';

const MODULE_LABELS: Record<ModuleKey, string> = {
    ANIMAL_INTAKE: 'Animal Intake',
    WORKFORCE: 'Workforce',
    SHIPMENTS: 'Shipments',
    FORMS: 'Forms',
    FORMS_AI_DIGITIZE: 'Forms AI Digitize',
    BLOCKCHAIN_ANCHOR: 'Blockchain Anchor',
    PAYROLL: 'Payroll',
};

function formatDate(date: Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BillingSettingsPage() {
    const { billingEnabled, plan, status, currentPeriodEnd, enabledModules, isLoading } = useSubscription();

    if (isLoading) {
        return <CenteredCard>Loading…</CenteredCard>;
    }

    if (!billingEnabled) {
        return (
            <CenteredCard>
                <h1 className="text-xl font-bold text-gray-900">Billing</h1>
                <p className="mt-3 text-sm text-gray-600">
                    You&apos;re on full access during our free early-access period — pricing coming soon.
                </p>
            </CenteredCard>
        );
    }

    return <BillingDetails plan={plan} status={status} currentPeriodEnd={currentPeriodEnd} enabledModules={enabledModules} />;
}

function BillingDetails({
    plan,
    status,
    currentPeriodEnd,
    enabledModules,
}: {
    plan: string | undefined;
    status: string | undefined;
    currentPeriodEnd: Date | null | undefined;
    enabledModules: ModuleKey[];
}) {
    const portalMutation = trpc.billing.createPortalSession.useMutation({
        onSuccess: (result) => {
            window.location.href = result.url;
        },
    });

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-2xl">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
                    <p className="mt-1 text-sm text-gray-600">Your organization&apos;s subscription and enabled modules.</p>
                </header>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div>
                            <dt className="text-xs uppercase tracking-wider text-gray-400">Plan</dt>
                            <dd className="mt-0.5 font-semibold text-gray-900">{plan ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wider text-gray-400">Status</dt>
                            <dd className="mt-0.5 font-semibold text-gray-900">{status ?? '—'}</dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-xs uppercase tracking-wider text-gray-400">Renews</dt>
                            <dd className="mt-0.5 font-semibold text-gray-900">{formatDate(currentPeriodEnd)}</dd>
                        </div>
                    </dl>

                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <p className="mb-2 text-xs uppercase tracking-wider text-gray-400">Enabled modules</p>
                        {enabledModules.length === 0 ? (
                            <p className="text-sm text-gray-500">No modules enabled yet.</p>
                        ) : (
                            <ul className="flex flex-wrap gap-2">
                                {enabledModules.map((key) => (
                                    <li key={key} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                        {MODULE_LABELS[key]}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-2 text-xs text-gray-400">
                            To change which modules are enabled, contact your account manager.
                        </p>
                    </div>

                    {portalMutation.isError && (
                        <p className="mt-4 text-sm text-red-600">{portalMutation.error.message}</p>
                    )}

                    <button
                        type="button"
                        onClick={() => portalMutation.mutate()}
                        disabled={portalMutation.isPending}
                        className="mt-6 w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
                    >
                        {portalMutation.isPending ? 'Redirecting…' : 'Manage billing'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CenteredCard({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                {children}
            </div>
        </div>
    );
}
