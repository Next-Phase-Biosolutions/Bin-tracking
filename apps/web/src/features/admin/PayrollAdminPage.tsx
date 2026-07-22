import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Stat, Badge, Button } from '../../components/ui/primitives';

type OverviewRow = RouterOutputs['admin']['payrollOverview'][number];
type RunSummaryRow = RouterOutputs['admin']['payrollOrgRuns'][number];
type RunDetail = RouterOutputs['admin']['payrollRunDetail'];

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

/**
 * Read-only platform-admin monitor: every org's PAYROLL toggle state and
 * latest run, drilling into an org's run history and then one run's line
 * items/exceptions. Drill-down state lives in the URL (?orgId=&runId=) so a
 * link to a specific run is shareable. No mutation here — toggling PAYROLL
 * stays on the existing Org Modules page (admin.toggleModule).
 */
export default function PayrollAdminPage() {
    const whoAmI = trpc.admin.whoAmI.useQuery();

    if (whoAmI.isLoading) {
        return <CenteredMessage>Loading…</CenteredMessage>;
    }
    if (!whoAmI.data?.isPlatformAdmin) {
        return <CenteredMessage>Access denied. Platform admin only.</CenteredMessage>;
    }
    return <PayrollAdminContent />;
}

function PayrollAdminContent() {
    const [params, setParams] = useSearchParams();
    const orgId = params.get('orgId');
    const runId = params.get('runId');

    if (runId) {
        return <RunDetailView runId={runId} onBack={() => setParams(orgId ? { orgId } : {})} />;
    }
    if (orgId) {
        return (
            <OrgRunsView
                orgId={orgId}
                onBack={() => setParams({})}
                onSelectRun={(id) => setParams({ orgId, runId: id })}
            />
        );
    }
    return <OverviewView onSelectOrg={(id) => setParams({ orgId: id })} />;
}

function OverviewView({ onSelectOrg }: { onSelectOrg: (orgId: string) => void }) {
    const query = trpc.admin.payrollOverview.useQuery();
    const rows = query.data ?? [];

    const enabledCount = rows.filter((r) => r.payrollEnabled).length;
    const heldTotal = rows.reduce((sum, r) => sum + r.heldCount, 0);
    const failedTotal = rows.reduce((sum, r) => sum + r.failedCount, 0);

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Payroll Monitor"
                subtitle="Every organization's PAYROLL status and most recent run."
                icon={<Icon name="clock" width={22} height={22} />}
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat label="Organizations" value={rows.length} />
                <Stat label="Payroll enabled" value={enabledCount} />
                <Stat
                    label="Held / failed (all runs)"
                    value={`${heldTotal} / ${failedTotal}`}
                    accent={heldTotal + failedTotal > 0}
                />
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-edge/60">
                                <Th>Organization</Th>
                                <Th>Payroll</Th>
                                <Th>Latest run</Th>
                                <Th>Status</Th>
                                <Th>Held</Th>
                                <Th>Failed</Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/40">
                            {query.isLoading ? (
                                <EmptyRow colSpan={6}>Loading…</EmptyRow>
                            ) : query.isError ? (
                                <EmptyRow colSpan={6} tone="alert">
                                    {query.error.message}
                                </EmptyRow>
                            ) : rows.length === 0 ? (
                                <EmptyRow colSpan={6}>No organizations yet.</EmptyRow>
                            ) : (
                                rows.map((row: OverviewRow) => (
                                    <tr
                                        key={row.orgId}
                                        role="link"
                                        tabIndex={0}
                                        aria-label={`Open payroll runs for ${row.orgName}`}
                                        onClick={() => onSelectOrg(row.orgId)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onSelectOrg(row.orgId);
                                            }
                                        }}
                                        className="cursor-pointer hover:bg-bone-light focus:bg-bone-light focus:outline-none"
                                    >
                                        <td className="px-5 py-3 font-medium text-ink">{row.orgName}</td>
                                        <td className="px-5 py-3">
                                            <Badge tone={row.payrollEnabled ? 'good' : 'idle'}>
                                                {row.payrollEnabled ? 'On' : 'Off'}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3 text-muted">{row.latestRun?.period ?? '—'}</td>
                                        <td className="px-5 py-3">
                                            {row.latestRun ? (
                                                <Badge tone={runStatusTone[row.latestRun.status] ?? 'idle'}>
                                                    {row.latestRun.status}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-muted">{row.heldCount}</td>
                                        <td className="px-5 py-3 text-muted">{row.failedCount}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function OrgRunsView({
    orgId,
    onBack,
    onSelectRun,
}: {
    orgId: string;
    onBack: () => void;
    onSelectRun: (runId: string) => void;
}) {
    const query = trpc.admin.payrollOrgRuns.useQuery({ orgId });
    const rows = query.data ?? [];

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Run history"
                subtitle="Every payroll run computed for this organization, newest first."
                icon={<Icon name="clock" width={22} height={22} />}
                actions={<Button variant="secondary" onClick={onBack}>Back to overview</Button>}
            />

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
                            {query.isLoading ? (
                                <EmptyRow colSpan={4}>Loading…</EmptyRow>
                            ) : query.isError ? (
                                <EmptyRow colSpan={4} tone="alert">
                                    {query.error.message}
                                </EmptyRow>
                            ) : rows.length === 0 ? (
                                <EmptyRow colSpan={4}>No runs yet.</EmptyRow>
                            ) : (
                                rows.map((run: RunSummaryRow) => (
                                    <tr
                                        key={run.id}
                                        role="link"
                                        tabIndex={0}
                                        aria-label={`Open payroll run ${run.period}`}
                                        onClick={() => onSelectRun(run.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onSelectRun(run.id);
                                            }
                                        }}
                                        className="cursor-pointer hover:bg-bone-light focus:bg-bone-light focus:outline-none"
                                    >
                                        <td className="px-5 py-3 font-medium text-ink">{run.period}</td>
                                        <td className="px-5 py-3">
                                            <Badge tone={runStatusTone[run.status] ?? 'idle'}>{run.status}</Badge>
                                        </td>
                                        <td className="px-5 py-3 text-muted">{run.totalEmployees}</td>
                                        <td className="px-5 py-3 text-muted">{formatCents(run.totalGrossCents, run.currency)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function RunDetailView({ runId, onBack }: { runId: string; onBack: () => void }) {
    const query = trpc.admin.payrollRunDetail.useQuery({ runId });
    const run = query.data;

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title={run ? `${run.orgName} — ${run.period}` : 'Run detail'}
                subtitle="Line items and held-back exceptions for this run."
                icon={<Icon name="clock" width={22} height={22} />}
                actions={<Button variant="secondary" onClick={onBack}>Back to runs</Button>}
            />

            {query.isLoading ? (
                <CenteredMessage>Loading…</CenteredMessage>
            ) : query.isError ? (
                <CenteredMessage>{query.error.message}</CenteredMessage>
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
                                        <Th>Account</Th>
                                        <Th>Gross</Th>
                                        <Th>Payout status</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge/40">
                                    {run.lineItems.length === 0 ? (
                                        <EmptyRow colSpan={4}>No line items.</EmptyRow>
                                    ) : (
                                        run.lineItems.map((li) => (
                                            <tr key={li.id}>
                                                <td className="px-5 py-3 font-medium text-ink">{li.fullName}</td>
                                                <td className="px-5 py-3 text-muted">
                                                    {li.bankAccountLast4 ? `****${li.bankAccountLast4}` : '—'}
                                                </td>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-edge/60">
                                        <Th>Employee</Th>
                                        <Th>Reason</Th>
                                        <Th>Resolved</Th>
                                        <Th>Note</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge/40">
                                    {run.exceptions.length === 0 ? (
                                        <EmptyRow colSpan={4}>No exceptions.</EmptyRow>
                                    ) : (
                                        run.exceptions.map((ex) => (
                                            <tr key={ex.id}>
                                                <td className="px-5 py-3 font-medium text-ink">{ex.fullName}</td>
                                                <td className="px-5 py-3 text-muted">{ex.type}</td>
                                                <td className="px-5 py-3">
                                                    <Badge tone={ex.resolved ? 'good' : 'pending'}>
                                                        {ex.resolved ? 'Resolved' : 'Open'}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3 text-muted">{ex.note ?? '—'}</td>
                                            </tr>
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
