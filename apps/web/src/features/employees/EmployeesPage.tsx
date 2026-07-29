import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge, Button, Stat } from '../../components/ui/primitives';
import { EmployeeBadge } from './EmployeeBadge';

type Employee = RouterOutputs['employee']['list'][number];

export default function EmployeesPage() {
    const [search, setSearch] = useState('');
    const [badgeFor, setBadgeFor] = useState<Employee | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const trimmed = search.trim();

    const utils = trpc.useUtils();
    const listQuery = trpc.employee.list.useQuery(
        { search: trimmed || undefined, limit: 200 },
        { staleTime: 10_000, placeholderData: (prev) => prev },
    );

    const requestBankDetails = trpc.employee.requestBankDetails.useMutation({
        onSuccess: (result) => {
            setSentTo(result.email);
            void utils.employee.list.invalidate();
        },
    });

    const { hasModule, isLoading } = useSubscription();

    // Rates are a PAYROLL-module feature AND ADMIN/OPS-only — the API strips
    // them (and FORBIDs the write) unless both hold, so only render the Rate
    // column when it would actually work.
    const me = trpc.auth.me.useQuery();
    const canManageRates =
        (me.data?.orgRole === 'ADMIN' || me.data?.orgRole === 'OPS_MANAGER') && hasModule('PAYROLL');

    const setRate = trpc.employee.setHourlyRate.useMutation({
        onSuccess: () => void utils.employee.list.invalidate(),
    });

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <FacilityLoader variant="inline" label="employees" />
            </div>
        );
    }

    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <UpgradePrompt module="WORKFORCE" />
            </div>
        );
    }

    // Employee badges (qrCode) are check-in credentials — the API itself
    // already 403s this for non-admin roles (orgOpsProcedure), this just
    // avoids showing a broken page to someone who reached the URL directly.
    if (me.data?.orgRole !== 'ADMIN' && me.data?.orgRole !== 'OPS_MANAGER') {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">
                Employees is available to admins and ops managers only.
            </div>
        );
    }

    const rows = listQuery.data ?? [];
    const colCount = canManageRates ? 7 : 6;
    // ponytail: counts derived from the (capped) list rather than a dedicated
    // employee.stats endpoint — PLAN_LIMITS caps PRO at 200 employees, which
    // the limit above covers. Add the endpoint if an ENTERPRISE org exceeds it.
    const activeCount = rows.filter((e) => e.status === 'ACTIVE').length;
    const missingBankCount = rows.filter((e) => !e.bankDetailsAt).length;

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Employees"
                subtitle="Everyone registered in your organization, their badge, and their direct deposit status."
                icon={<Icon name="users" width={22} height={22} />}
                actions={
                    <Link to="/app/employees/register">
                        <Button>
                            <Icon name="badge" width={15} height={15} /> Register Employee
                        </Button>
                    </Link>
                }
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                    label="total_employees"
                    value={rows.length}
                    icon={<Icon name="users" width={18} height={18} />}
                />
                <Stat
                    label="currently_active"
                    value={activeCount}
                    icon={<Icon name="check" width={18} height={18} />}
                />
                <Stat
                    label="bank_details_missing"
                    value={missingBankCount}
                    sub={missingBankCount > 0 ? 'Their pay is held until submitted' : 'Everyone can be paid'}
                    accent={missingBankCount > 0}
                    icon={<Icon name="badge" width={18} height={18} />}
                />
            </div>

            {sentTo && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm text-olive-deep">
                    <span className="flex items-center gap-2">
                        <Icon name="check" width={16} height={16} />
                        Bank details link sent to <strong>{sentTo}</strong>. It expires in 7 days and works once.
                    </span>
                    <button onClick={() => setSentTo(null)} className="text-xs font-semibold text-muted hover:text-olive-deep">
                        Dismiss
                    </button>
                </div>
            )}

            {requestBankDetails.isError && (
                <div className="mb-4 rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                    {requestBankDetails.error.message}
                </div>
            )}

            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/60 px-5 py-3.5">
                    <h2 className="font-display font-bold text-olive-deep">Registered employees</h2>
                    <div className="flex items-center gap-3">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, code, department…"
                            aria-label="Search employees"
                            className="w-56 rounded-lg border border-edge px-3 py-1.5 text-sm text-ink outline-none focus:border-rust"
                        />
                        <button
                            onClick={() => void listQuery.refetch()}
                            className="flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep"
                        >
                            <Icon name="refresh" width={15} height={15} className={listQuery.isFetching ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-edge/60">
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Employee</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Department</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Position</th>
                                {canManageRates ? (
                                    <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Rate</th>
                                ) : null}
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Status</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Direct deposit</th>
                                <th className="px-5 py-2.5 text-right font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Badge</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/40">
                            {listQuery.isLoading ? (
                                <tr>
                                    <td colSpan={colCount} className="px-5 py-8 text-center text-muted">Loading…</td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={colCount} className="px-5 py-10 text-center text-muted">
                                        {trimmed ? 'No employees match your search.' : (
                                            <span>
                                                No employees registered yet.{' '}
                                                <Link to="/app/employees/register" className="font-medium text-rust hover:underline">
                                                    Register the first one
                                                </Link>
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-bone-light/40">
                                        <td className="px-5 py-3">
                                            <div className="font-medium text-ink">{row.fullName}</div>
                                            <div className="font-mono text-xs text-muted">{row.employeeCode}</div>
                                        </td>
                                        <td className="px-5 py-3 text-muted">{row.department ?? '—'}</td>
                                        <td className="px-5 py-3 text-muted">{row.position ?? '—'}</td>
                                        {canManageRates ? (
                                            <td className="px-5 py-3">
                                                <RateCell
                                                    employee={row}
                                                    pending={setRate.isPending && setRate.variables?.employeeId === row.id}
                                                    onSave={(cents) => setRate.mutate({ employeeId: row.id, hourlyRateCents: cents })}
                                                />
                                            </td>
                                        ) : null}
                                        <td className="px-5 py-3">
                                            <Badge tone={row.status === 'ACTIVE' ? 'good' : 'idle'}>{row.status}</Badge>
                                        </td>
                                        <td className="px-5 py-3">
                                            <BankDetailsCell
                                                employee={row}
                                                pending={
                                                    requestBankDetails.isPending &&
                                                    requestBankDetails.variables?.employeeId === row.id
                                                }
                                                onRequest={() => requestBankDetails.mutate({ employeeId: row.id })}
                                            />
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => setBadgeFor(row)}
                                                aria-label={`View badge for ${row.fullName}`}
                                                className="rounded-lg border border-edge bg-white px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-olive-deep transition-colors hover:border-rust hover:bg-rust/5 hover:text-rust"
                                            >
                                                View badge
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {badgeFor && <BadgeModal employee={badgeFor} onClose={() => setBadgeFor(null)} />}
        </div>
    );
}

interface RateCellProps {
    employee: Employee;
    pending: boolean;
    onSave: (hourlyRateCents: number | null) => void;
}

/**
 * Per-employee rate: shows the override amount (or a "Default" badge when unset,
 * meaning the org flat rate applies), with an inline editor. Only rendered for
 * ADMIN/OPS; the API strips the rate and FORBIDs the write for other roles.
 */
function RateCell({ employee, pending, onSave }: RateCellProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const startEdit = () => {
        setDraft(employee.hourlyRateCents != null ? (employee.hourlyRateCents / 100).toFixed(2) : '');
        setEditing(true);
    };

    const commit = (raw: string) => {
        const trimmed = raw.trim();
        if (trimmed === '') {
            onSave(null); // clear → org default
        } else {
            const cents = Math.round(Number.parseFloat(trimmed) * 100);
            if (!Number.isInteger(cents) || cents <= 0) {
                setEditing(false);
                return;
            }
            onSave(cents);
        }
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                autoFocus
                defaultValue={draft}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditing(false);
                }}
                aria-label={`Hourly rate for ${employee.fullName} in dollars, blank for org default`}
                className="w-24 rounded-lg border border-rust bg-white px-2 py-1 text-sm text-ink outline-none"
            />
        );
    }

    return (
        <button
            onClick={startEdit}
            disabled={pending}
            aria-label={`Edit hourly rate for ${employee.fullName}`}
            className="inline-flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-rust/5 disabled:opacity-50"
        >
            {employee.hourlyRateCents != null ? (
                <span className="font-mono text-sm text-ink">${(employee.hourlyRateCents / 100).toFixed(2)}</span>
            ) : (
                <Badge tone="idle">Default</Badge>
            )}
            <Icon name="badge" width={12} height={12} className="text-muted" />
        </button>
    );
}

interface BankDetailsCellProps {
    employee: Employee;
    pending: boolean;
    onRequest: () => void;
}

/**
 * Shows the masked status and the request button. Admins never see or type the
 * real numbers — the employee submits them through their own emailed link, so
 * `****1234` (bankAccountLast4) is the most this cell can ever display.
 */
function BankDetailsCell({ employee, pending, onRequest }: BankDetailsCellProps) {
    const hasDetails = Boolean(employee.bankDetailsAt);
    const canEmail = Boolean(employee.email);

    return (
        <div className="flex items-center gap-3">
            {hasDetails ? (
                <span className="flex items-center gap-1.5 font-mono text-xs text-live">
                    <Icon name="check" width={13} height={13} />
                    ****{employee.bankAccountLast4}
                </span>
            ) : (
                <span className="font-mono text-xs text-muted">— not set</span>
            )}
            <button
                onClick={onRequest}
                disabled={pending || !canEmail}
                title={canEmail ? undefined : 'Add an email address for this employee first'}
                className="rounded-lg border border-edge bg-white px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-olive-deep transition-colors hover:border-rust hover:bg-rust/5 hover:text-rust disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-edge disabled:hover:bg-white disabled:hover:text-olive-deep"
            >
                {pending ? 'Sending…' : hasDetails ? 'Resend' : 'Send request'}
            </button>
        </div>
    );
}

function BadgeModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
    // Escape closes it — a dialog you can only dismiss with the mouse is a
    // keyboard trap.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`Badge for ${employee.fullName}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
            onClick={onClose}
        >
            <div className="max-h-full w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <EmployeeBadge
                    employee={employee}
                    footer={
                        <button onClick={onClose} className="mt-4 text-sm font-medium text-rust hover:underline">
                            Close
                        </button>
                    }
                />
            </div>
        </div>
    );
}
