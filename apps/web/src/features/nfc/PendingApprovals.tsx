import { useState } from 'react';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { refreshQuery } from '../../lib/refresh';
import { Card } from '../../components/ui/primitives';
import { describeAdminError } from './errors';
import { formatDuration } from './tap-view';

type Pending = RouterOutputs['attendance']['listPendingApprovals'][number];

const dateTime = (d: Date) => d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Forgotten check-outs. A shift left open 16 h or more is closed at that cap and
 * HELD out of payroll until a manager approves it as-is, or enters the real
 * check-out time (genuine overtime, or an earlier real exit).
 */
export function PendingApprovals() {
    const utils = trpc.useUtils();
    const pending = trpc.attendance.listPendingApprovals.useQuery(undefined, { staleTime: 10_000 });
    const [approvedNotice, setApprovedNotice] = useState(false);

    const approve = trpc.attendance.approveWorkSession.useMutation({
        onSuccess: async () => {
            setApprovedNotice(true);
            await Promise.all([refreshQuery(utils.attendance.listPendingApprovals), refreshQuery(utils.attendance.facilityStatus)]);
        },
    });

    const rows = pending.data ?? [];
    // Nothing to approve (or still loading): render nothing rather than an empty box.
    if (rows.length === 0 && !approvedNotice) return null;

    return (
        <Card as="section" className="mb-6 overflow-hidden ring-1 ring-warn/30">
            <h2 className="border-b border-edge/60 px-5 py-3.5 font-display font-bold text-olive-deep">
                Forgotten check-outs <span className="font-mono text-xs font-normal text-muted">({rows.length})</span>
            </h2>
            <p className="px-5 pt-3 text-sm text-muted">These shifts were auto-closed at 16 hours and are not paid until you approve them.</p>
            {approvedNotice && <p role="status" className="px-5 pt-3 text-sm text-live">Shift approved. Re-run payroll to include it.</p>}
            {approve.isError && <p role="alert" className="px-5 pt-3 text-sm text-rust">{describeAdminError(approve.error)}</p>}
            <ul className="divide-y divide-edge/40">
                {rows.map((row) => (
                    <ApprovalRow key={row.id} row={row} busy={approve.isPending && approve.variables?.id === row.id} onApprove={(checkOutAt) => { setApprovedNotice(false); approve.mutate({ id: row.id, checkOutAt }); }} />
                ))}
            </ul>
        </Card>
    );
}

function ApprovalRow({ row, busy, onApprove }: { row: Pending; busy: boolean; onApprove: (checkOutAt?: string) => void }) {
    const [custom, setCustom] = useState(false);
    const [value, setValue] = useState('');

    return (
        <li className="px-5 py-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <span className="font-medium text-ink">{row.employee.fullName}</span>{' '}
                    <span className="font-mono text-xs text-muted">{row.employee.employeeCode}</span>
                    <div className="text-muted">
                        In {dateTime(row.checkInAt)} · closed at {formatDuration(row.durationMin ?? 0)}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onApprove()}
                        aria-label={`Approve ${row.employee.fullName} as-is`}
                        className="rounded-lg bg-olive-deep px-3 py-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-bone-light disabled:opacity-50"
                    >
                        {busy ? 'Approving…' : 'Approve as-is'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setCustom((v) => !v)}
                        aria-label={`Enter a real check-out time for ${row.employee.fullName}`}
                        className="rounded-lg border border-edge bg-white px-3 py-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-olive-deep hover:border-rust hover:text-rust"
                    >
                        Different check-out time
                    </button>
                </div>
            </div>
            {custom && (
                <form
                    className="mt-3 flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (value) onApprove(new Date(value).toISOString());
                    }}
                >
                    <label className="text-sm">
                        <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Real check-out</span>
                        <input
                            type="datetime-local"
                            required
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            aria-label={`Real check-out time for ${row.employee.fullName}`}
                            className="rounded-lg border border-edge bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-rust"
                        />
                    </label>
                    <button type="submit" disabled={busy || !value} className="rounded-lg bg-olive-deep px-3 py-2 text-sm font-semibold text-bone-light disabled:opacity-50">
                        Approve with this time
                    </button>
                </form>
            )}
        </li>
    );
}
