import type { ReactNode } from 'react';
import { MODULE_LABELS } from '@bin-tracker/types';
import type { ModuleKey } from '@bin-tracker/types';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge } from '../../components/ui/primitives';

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
                <h1 className="font-display text-xl font-extrabold text-olive-deep">Billing</h1>
                <p className="mt-3 text-sm text-muted">
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
    const me = trpc.auth.me.useQuery(undefined, { staleTime: 300_000 });
    const isAdmin = me.data?.orgRole === 'ADMIN';

    const portalMutation = trpc.billing.createPortalSession.useMutation({
        onSuccess: (result) => {
            window.location.href = result.url;
        },
    });

    return (
        <div className="mx-auto max-w-2xl">
            <PageHeader
                title="Billing"
                subtitle="Your organization's subscription and enabled modules."
                icon={<Icon name="badge" width={22} height={22} />}
            />

            <Card className="p-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                    <div>
                        <dt className="kicker">Plan</dt>
                        <dd className="mt-0.5 font-semibold text-ink">{plan ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="kicker">Status</dt>
                        <dd className="mt-0.5 font-semibold text-ink">{status ?? '—'}</dd>
                    </div>
                    <div className="col-span-2">
                        <dt className="kicker">Renews</dt>
                        <dd className="mt-0.5 font-semibold text-ink">{formatDate(currentPeriodEnd)}</dd>
                    </div>
                </dl>

                <div className="mt-6 border-t border-edge/60 pt-4">
                    <p className="kicker mb-2">Enabled modules</p>
                    {enabledModules.length === 0 ? (
                        <p className="text-sm text-muted">No modules enabled yet.</p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {enabledModules.map((key) => (
                                <li key={key}>
                                    <Badge tone="good">{MODULE_LABELS[key]}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-2 text-xs text-muted">
                        To change which modules are enabled, contact your account manager.
                    </p>
                </div>

                {portalMutation.isError && (
                    <p className="mt-4 text-sm text-rust">{portalMutation.error.message}</p>
                )}

                {/* Managing the subscription is an admin action — the server
                    gates billing.createPortalSession by org role too; this just
                    keeps a non-admin from clicking a button that would 403. */}
                {isAdmin ? (
                    <button
                        type="button"
                        onClick={() => portalMutation.mutate()}
                        disabled={portalMutation.isPending}
                        className="mt-6 w-full rounded-xl bg-rust py-3 text-sm font-bold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                    >
                        {portalMutation.isPending ? 'Redirecting…' : 'Manage billing'}
                    </button>
                ) : (
                    <p className="mt-6 text-sm text-muted">
                        Contact an organization admin to change the subscription.
                    </p>
                )}
            </Card>
        </div>
    );
}

function CenteredCard({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <Card className="w-full max-w-md p-8 text-center">{children}</Card>
        </div>
    );
}
