import { trpc, type RouterOutputs } from '../../lib/trpc';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Stat } from '../../components/ui/primitives';
import { ManagerGate } from './ManagerGate';
import { PendingApprovals } from './PendingApprovals';
import { describeAdminError } from './errors';
import { formatDuration, formatTime } from './tap-view';

type Status = RouterOutputs['attendance']['facilityStatus'];

/** Live floor status, refreshed every 5 s. Read-only: it never closes or changes a shift. */
export default function LiveStatusPage({ pollMs = 5000 }: { pollMs?: number }) {
    return (
        <ManagerGate label="Live status">
            <LiveStatus pollMs={pollMs} />
        </ManagerGate>
    );
}

function LiveStatus({ pollMs }: { pollMs: number }) {
    const status = trpc.attendance.facilityStatus.useQuery(undefined, {
        refetchInterval: pollMs,
        refetchIntervalInBackground: false, // a hidden tab stops hitting the API
        retry: false,
    });

    if (status.isLoading) return <p className="py-16 text-center text-muted">Loading live status…</p>;
    if (!status.data) {
        return <p role="alert" className="py-16 text-center text-rust">Could not load the live status. {describeAdminError(status.error)}</p>;
    }
    const data = status.data;
    const { totals } = data;

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title="Live status"
                subtitle={`Updated ${formatTime(data.asOf)} · refreshes every ${Math.round(pollMs / 1000)} s`}
                icon={<Icon name="clock" width={22} height={22} />}
            />

            {status.isError && (
                <p role="alert" className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
                    Connection lost. Showing the last known status.
                </p>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="employees" value={totals.active} sub={totals.inactive > 0 ? `+ ${totals.inactive} inactive` : undefined} icon={<Icon name="users" width={18} height={18} />} />
                <Stat label="checked_in" value={totals.checkedIn} icon={<Icon name="check" width={18} height={18} />} />
                <Stat label="checked_out" value={totals.checkedOut} />
                {totals.overdue > 0 && (
                    <Stat label="needs_attention" value={totals.overdue} sub="open 16 h or more — likely a forgotten check-out" accent />
                )}
            </div>

            {totals.unregistered > 0 && (
                <p className="mb-6 rounded-xl border border-edge bg-bone-light/60 px-4 py-3 text-sm text-ink">
                    {totals.unregistered} active {totals.unregistered === 1 ? 'employee has' : 'employees have'} no registered phone yet, so{' '}
                    {totals.unregistered === 1 ? 'they cannot' : 'they cannot'} tap in. Set one up from the Employees page.
                </p>
            )}

            <PendingApprovals />

            <Section title="Checked in" empty="Nobody is checked in." rows={data.checkedIn} render={(e) => <Since asOf={data.asOf} since={e.since} />} />
            {data.overdue.length > 0 && (
                <Section title="Needs attention" tone="alert" empty="" rows={data.overdue} render={(e) => <Since asOf={data.asOf} since={e.since} />} />
            )}
            <Section
                title="Checked out"
                empty="Everyone is checked in."
                rows={data.checkedOut}
                render={(e) => <span className="text-muted">{e.lastCheckOutAt ? `last out ${formatTime(e.lastCheckOutAt)}` : 'never checked out'}</span>}
            />
        </div>
    );
}

type Row = { employeeId: string; fullName: string; employeeCode: string };

function Section<T extends Row>({
    title,
    rows,
    empty,
    render,
    tone,
}: {
    title: string;
    rows: T[];
    empty: string;
    render: (row: T) => React.ReactNode;
    tone?: 'alert';
}) {
    return (
        <Card as="section" className={`mb-6 overflow-hidden ${tone === 'alert' ? 'ring-1 ring-rust/30' : ''}`}>
            <h2 className="border-b border-edge/60 px-5 py-3.5 font-display font-bold text-olive-deep">
                {title} <span className="font-mono text-xs font-normal text-muted">({rows.length})</span>
            </h2>
            {rows.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted">{empty}</p>
            ) : (
                <ul className="divide-y divide-edge/40">
                    {rows.map((row) => (
                        <li key={row.employeeId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                            <span>
                                <span className="font-medium text-ink">{row.fullName}</span>{' '}
                                <span className="font-mono text-xs text-muted">{row.employeeCode}</span>
                            </span>
                            {render(row)}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/** Time since check-in, measured against the SERVER's clock so a wrong laptop clock cannot skew it. */
function Since({ asOf, since }: { asOf: Date; since: Date }) {
    const minutes = Math.max(0, Math.round((asOf.getTime() - since.getTime()) / 60_000));
    return (
        <span className="text-muted">
            since {formatTime(since)} · {formatDuration(minutes)}
        </span>
    );
}
