import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { Icon } from '../../components/ui/Icon';
import { Card, Stat, Badge, Button } from '../../components/ui/primitives';

type RunSummary = RouterOutputs['payroll']['listRuns'][number];
type RunDetail = RouterOutputs['payroll']['getRun'];
type RunException = RunDetail['exceptions'][number];

const runStatusTone: Record<string, 'idle' | 'pending' | 'good' | 'complete'> = {
    DRAFT: 'idle',
    APPROVED: 'pending',
    PAID: 'complete',
    CANCELLED: 'idle',
};

const payoutStatusTone: Record<string, 'idle' | 'pending' | 'good' | 'alert'> = {
    PENDING: 'pending',
    PAID: 'good',
    FAILED: 'alert',
    HELD: 'alert',
};

function formatCents(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(cents / 100);
}

/** Browser-local current month as 'YYYY-MM' — a default the admin can override by picking a run. */
function currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Org-facing payroll: compute the month, review line items, resolve held-back
 * exceptions. ADMIN/OPS only (the API enforces via orgOpsProcedure; the render
 * gate is defense-in-depth) and PAYROLL-module-gated. Approval itself happens
 * out-of-band — the payout agent emails the configured manager.
 */
export default function PayrollPage() {
    const me = trpc.auth.me.useQuery();
    const { hasModule, isLoading } = useSubscription();

    if (isLoading || me.isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <FacilityLoader variant="inline" label="payroll" />
            </div>
        );
    }
    if (!hasModule('PAYROLL')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <UpgradePrompt module="PAYROLL" />
            </div>
        );
    }
    if (me.data?.orgRole !== 'ADMIN' && me.data?.orgRole !== 'OPS_MANAGER') {
        return <CenteredMessage>Payroll is available to admins and ops managers only.</CenteredMessage>;
    }
    return <PayrollContent />;
}

function PayrollContent() {
    const [params, setParams] = useSearchParams();
    const period = params.get('period');

    if (period) {
        return <RunDetailView period={period} onBack={() => setParams({})} />;
    }
    return <RunsView onSelect={(p) => setParams({ period: p })} />;
}

// ─── Runs list + compute ───────────────────────────────────────────────────

function RunsView({ onSelect }: { onSelect: (period: string) => void }) {
    const utils = trpc.useUtils();
    const runsQuery = trpc.payroll.listRuns.useQuery({ limit: 24 });
    const [jobId, setJobId] = useState<string | null>(null);
    const [computeError, setComputeError] = useState<string | null>(null);

    const compute = trpc.payroll.computeRun.useMutation({
        onSuccess: ({ jobId }) => setJobId(jobId),
        onError: (e) => setComputeError(e.message),
    });

    // Poll the async compute job until it settles, then refresh the list.
    trpc.payroll.jobStatus.useQuery(
        { jobId: jobId ?? '' },
        {
            enabled: jobId !== null,
            refetchInterval: (query) => {
                const state = query.state.data?.state;
                if (state === 'completed' || state === 'failed') {
                    setJobId(null);
                    if (state === 'failed') setComputeError(query.state.data?.error ?? 'Compute failed');
                    void utils.payroll.listRuns.invalidate();
                    void utils.payroll.getRun.invalidate();
                    return false;
                }
                return 1500;
            },
        },
    );

    const rows = runsQuery.data ?? [];
    const period = currentPeriod();
    const computing = compute.isPending || jobId !== null;

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title="Payroll"
                subtitle="Monthly runs computed from recorded work sessions."
                icon={<Icon name="clock" width={22} height={22} />}
                actions={
                    <Button
                        onClick={() => {
                            setComputeError(null);
                            compute.mutate({ period });
                        }}
                        disabled={computing}
                    >
                        {computing ? 'Computing…' : `Compute ${period}`}
                    </Button>
                }
            />

            {computeError ? (
                <div className="mb-4 rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                    {computeError}
                </div>
            ) : null}

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-edge/60">
                                <Th>Period</Th>
                                <Th>Status</Th>
                                <Th>Employees</Th>
                                <Th>Gross</Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/40">
                            {runsQuery.isLoading ? (
                                <EmptyRow colSpan={4}>Loading…</EmptyRow>
                            ) : runsQuery.isError ? (
                                <EmptyRow colSpan={4} tone="alert">
                                    {runsQuery.error.message}
                                </EmptyRow>
                            ) : rows.length === 0 ? (
                                <EmptyRow colSpan={4}>No runs yet — compute your first month above.</EmptyRow>
                            ) : (
                                rows.map((run: RunSummary) => (
                                    <ClickableRow
                                        key={run.id}
                                        label={`Open payroll run ${run.period}`}
                                        onActivate={() => onSelect(run.period)}
                                    >
                                        <td className="px-5 py-3 font-medium text-ink">{run.period}</td>
                                        <td className="px-5 py-3">
                                            <Badge tone={runStatusTone[run.status] ?? 'idle'}>{run.status}</Badge>
                                        </td>
                                        <td className="px-5 py-3 text-muted">{run.totalEmployees}</td>
                                        <td className="px-5 py-3 text-muted">{formatCents(run.totalGrossCents, run.currency)}</td>
                                    </ClickableRow>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

// ─── Run detail + exception resolution ─────────────────────────────────────

function RunDetailView({ period, onBack }: { period: string; onBack: () => void }) {
    const utils = trpc.useUtils();
    const runQuery = trpc.payroll.getRun.useQuery({ period });
    const [recomputeNeeded, setRecomputeNeeded] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);

    const compute = trpc.payroll.computeRun.useMutation({ onSuccess: ({ jobId }) => setJobId(jobId) });
    trpc.payroll.jobStatus.useQuery(
        { jobId: jobId ?? '' },
        {
            enabled: jobId !== null,
            refetchInterval: (query) => {
                const state = query.state.data?.state;
                if (state === 'completed' || state === 'failed') {
                    setJobId(null);
                    setRecomputeNeeded(false);
                    void utils.payroll.getRun.invalidate({ period });
                    void utils.payroll.listRuns.invalidate();
                    return false;
                }
                return 1500;
            },
        },
    );

    const run = runQuery.data;
    const isDraft = run?.status === 'DRAFT';
    const computing = compute.isPending || jobId !== null;

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title={`Payroll — ${period}`}
                subtitle="Line items and held-back exceptions for this run."
                icon={<Icon name="clock" width={22} height={22} />}
                actions={
                    <div className="flex gap-2">
                        {isDraft ? (
                            <Button onClick={() => compute.mutate({ period })} disabled={computing}>
                                {computing ? 'Recomputing…' : 'Recompute'}
                            </Button>
                        ) : null}
                        <Button variant="secondary" onClick={onBack}>
                            Back to runs
                        </Button>
                    </div>
                }
            />

            {recomputeNeeded ? (
                <div className="mb-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
                    A checkout was fixed — recompute this run to include the repaired hours in pay.
                </div>
            ) : null}

            {runQuery.isLoading ? (
                <CenteredMessage>Loading…</CenteredMessage>
            ) : runQuery.isError ? (
                <CenteredMessage>{runQuery.error.message}</CenteredMessage>
            ) : run ? (
                <>
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Stat label="Status" value={<Badge tone={runStatusTone[run.status] ?? 'idle'}>{run.status}</Badge>} />
                        <Stat label="Employees paid" value={run.totalEmployees} />
                        <Stat label="Total gross" value={formatCents(run.totalGrossCents, run.currency)} />
                    </div>

                    <Card className="mb-6 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-edge/60">
                                        <Th>Employee</Th>
                                        <Th>Hours</Th>
                                        <Th>Rate</Th>
                                        <Th>Gross</Th>
                                        <Th>Payout</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge/40">
                                    {run.lineItems.length === 0 ? (
                                        <EmptyRow colSpan={5}>No payable hours in this period.</EmptyRow>
                                    ) : (
                                        run.lineItems.map((li) => (
                                            <tr key={li.id}>
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-ink">{li.fullName}</div>
                                                    <div className="font-mono text-xs text-muted">{li.employeeCode}</div>
                                                </td>
                                                <td className="px-5 py-3 text-muted">{(li.minutes / 60).toFixed(2)}</td>
                                                <td className="px-5 py-3 text-muted">{formatCents(li.rateCents, run.currency)}/hr</td>
                                                <td className="px-5 py-3 text-muted">{formatCents(li.grossCents, run.currency)}</td>
                                                <td className="px-5 py-3">
                                                    <Badge tone={payoutStatusTone[li.payoutStatus] ?? 'idle'}>{li.payoutStatus}</Badge>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="border-b border-edge/50 px-5 py-3.5">
                            <h2 className="font-display font-bold text-olive-deep">Held-back sessions</h2>
                            <p className="mt-0.5 text-xs text-muted">
                                Dirty sessions excluded from pay. Fix the missing checkout to pay the hours, or dismiss to
                                leave them unpaid.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-edge/60">
                                        <Th>Employee</Th>
                                        <Th>Reason</Th>
                                        <Th>Shift started</Th>
                                        <Th>Status</Th>
                                        <Th>Actions</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge/40">
                                    {run.exceptions.length === 0 ? (
                                        <EmptyRow colSpan={5}>No exceptions — every session was clean.</EmptyRow>
                                    ) : (
                                        run.exceptions.map((ex) => (
                                            <ExceptionRow
                                                key={ex.id}
                                                exception={ex}
                                                period={period}
                                                canResolve={isDraft}
                                                onResolved={(requiresRecompute) => {
                                                    if (requiresRecompute) setRecomputeNeeded(true);
                                                }}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : null}
        </div>
    );
}

function ExceptionRow({
    exception,
    period,
    canResolve,
    onResolved,
}: {
    exception: RunException;
    period: string;
    canResolve: boolean;
    onResolved: (requiresRecompute: boolean) => void;
}) {
    const utils = trpc.useUtils();
    const [fixing, setFixing] = useState(false);
    const [checkOutLocal, setCheckOutLocal] = useState('');

    const resolve = trpc.payroll.resolveException.useMutation({
        onSuccess: (result) => {
            setFixing(false);
            onResolved(result.requiresRecompute);
            void utils.payroll.getRun.invalidate({ period });
        },
    });

    const reasonLabel = exception.type === 'NO_CHECKOUT' ? 'No checkout' : 'Auto-closed';

    return (
        <tr>
            <td className="px-5 py-3">
                <div className="font-medium text-ink">{exception.fullName}</div>
                <div className="font-mono text-xs text-muted">{exception.employeeCode}</div>
            </td>
            <td className="px-5 py-3 text-muted">{reasonLabel}</td>
            <td className="px-5 py-3 text-muted">{new Date(exception.checkInAt).toLocaleString()}</td>
            <td className="px-5 py-3">
                <Badge tone={exception.resolved ? 'good' : 'pending'}>{exception.resolved ? 'Resolved' : 'Open'}</Badge>
                {exception.note ? <div className="mt-1 text-xs text-muted">{exception.note}</div> : null}
            </td>
            <td className="px-5 py-3">
                {exception.resolved || !canResolve ? (
                    <span className="text-xs text-muted">—</span>
                ) : fixing ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="datetime-local"
                            value={checkOutLocal}
                            onChange={(e) => setCheckOutLocal(e.target.value)}
                            aria-label={`Checkout time for ${exception.fullName}`}
                            className="rounded-lg border border-edge px-2 py-1 text-xs text-ink outline-none focus:border-rust"
                        />
                        <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-xs"
                            disabled={!checkOutLocal || resolve.isPending}
                            onClick={() =>
                                resolve.mutate({
                                    exceptionId: exception.id,
                                    action: 'FIX_CHECKOUT',
                                    checkOutAt: new Date(checkOutLocal).toISOString(),
                                })
                            }
                        >
                            {resolve.isPending ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setFixing(false)}>
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setFixing(true)}>
                            Fix checkout
                        </Button>
                        <Button
                            variant="ghost"
                            className="px-2.5 py-1 text-xs"
                            disabled={resolve.isPending}
                            onClick={() => {
                                const note = window.prompt('Why are these hours staying unpaid? (optional)') ?? undefined;
                                resolve.mutate({ exceptionId: exception.id, action: 'DISMISS', note: note || undefined });
                            }}
                        >
                            Dismiss
                        </Button>
                    </div>
                )}
                {resolve.isError ? <p className="mt-1 text-xs text-rust">{resolve.error.message}</p> : null}
            </td>
        </tr>
    );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

/** Table row that is clickable AND keyboard-operable (Enter / Space). */
function ClickableRow({
    children,
    label,
    onActivate,
}: {
    children: ReactNode;
    label: string;
    onActivate: () => void;
}) {
    return (
        <tr
            role="link"
            tabIndex={0}
            aria-label={label}
            onClick={onActivate}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActivate();
                }
            }}
            className="cursor-pointer hover:bg-bone-light focus:bg-bone-light focus:outline-none"
        >
            {children}
        </tr>
    );
}

function Th({ children }: { children: ReactNode }) {
    return <th className="px-5 py-3 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{children}</th>;
}

function EmptyRow({ children, colSpan, tone = 'muted' }: { children: ReactNode; colSpan: number; tone?: 'muted' | 'alert' }) {
    return (
        <tr>
            <td colSpan={colSpan} className={`px-5 py-8 text-center ${tone === 'alert' ? 'text-rust' : 'text-muted'}`}>
                {children}
            </td>
        </tr>
    );
}

function CenteredMessage({ children }: { children: ReactNode }) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">{children}</div>;
}
