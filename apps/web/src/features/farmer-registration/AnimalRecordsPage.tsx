import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge, Button, Stat } from '../../components/ui/primitives';

function formatDate(value: string | Date): string {
    const d = new Date(value);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AnimalRecordsPage() {
    const [search, setSearch] = useState('');
    const trimmed = search.trim();

    const utils = trpc.useUtils();
    const listQuery = trpc.farmer.list.useQuery(
        { search: trimmed || undefined, limit: 100 },
        { staleTime: 10_000, placeholderData: (prev) => prev },
    );
    const statsQuery = trpc.farmer.stats.useQuery(undefined, { staleTime: 10_000 });
    const me = trpc.auth.me.useQuery(undefined, { staleTime: 300_000 });
    const canDelete = me.data?.orgRole === 'ADMIN' || me.data?.orgRole === 'OPS_MANAGER';

    const removeMutation = trpc.farmer.remove.useMutation({
        onSuccess: () => {
            void utils.farmer.list.invalidate();
            void utils.farmer.stats.invalidate();
        },
    });

    const { hasModule, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <FacilityLoader variant="inline" label="animal records" />
            </div>
        );
    }

    if (!hasModule('ANIMAL_INTAKE')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <UpgradePrompt module="ANIMAL_INTAKE" />
            </div>
        );
    }

    const rows = listQuery.data ?? [];
    const stats = statsQuery.data;
    const topType = stats?.byType[0];

    const handleDelete = (id: string, label: string) => {
        if (window.confirm(`Delete the registration for "${label}"? This cannot be undone.`)) {
            removeMutation.mutate({ id });
        }
    };

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Animal Records"
                subtitle="Every animal registered by your organization."
                icon={<Icon name="cow" width={22} height={22} />}
                actions={
                    <Link to="/app/animalregistration">
                        <Button>
                            <Icon name="mic" width={15} height={15} /> Register Animal
                        </Button>
                    </Link>
                }
            />

            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                    label="total_registered"
                    value={stats?.total ?? '—'}
                    icon={<Icon name="cow" width={18} height={18} />}
                />
                <Stat
                    label="registered_this_week"
                    value={stats?.thisWeek ?? '—'}
                    icon={<Icon name="clock" width={18} height={18} />}
                />
                <Stat
                    label="most_common_type"
                    value={topType ? topType.animalType : '—'}
                    sub={topType ? `${topType.count} registered` : undefined}
                    icon={<Icon name="grid" width={18} height={18} />}
                />
            </div>

            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/60 px-5 py-3.5">
                    <h2 className="font-display font-bold text-olive-deep">Registrations</h2>
                    <div className="flex items-center gap-3">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search type, breed, plant ID…"
                            aria-label="Search registrations"
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
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Animal</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Plant ID</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Employee Received</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Age</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Weight</th>
                                <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Health</th>
                                <th className="px-5 py-2.5 text-right font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Registered</th>
                                {canDelete ? <th className="px-5 py-2.5" /> : null}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/40">
                            {listQuery.isLoading ? (
                                <tr>
                                    <td colSpan={canDelete ? 8 : 7} className="px-5 py-8 text-center text-muted">Loading…</td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={canDelete ? 8 : 7} className="px-5 py-10 text-center text-muted">
                                        {trimmed ? 'No registrations match your search.' : (
                                            <span>
                                                No animals registered yet.{' '}
                                                <Link to="/app/animalregistration" className="font-medium text-rust hover:underline">
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
                                            <div className="font-medium text-ink">{row.animalType}</div>
                                            {row.breed ? <div className="text-xs text-muted">{row.breed}</div> : null}
                                        </td>
                                        <td className="px-5 py-3 text-ink">{row.plantId}</td>
                                        <td className="px-5 py-3 text-ink">{row.employee?.fullName ?? '—'}</td>
                                        <td className="px-5 py-3 text-muted">{row.age ?? '—'}</td>
                                        <td className="px-5 py-3 text-muted">{row.weight ?? '—'}</td>
                                        <td className="px-5 py-3">
                                            {row.healthCondition ? (
                                                <Badge tone="good">{row.healthCondition}</Badge>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right text-muted">{formatDate(row.createdAt)}</td>
                                        {canDelete ? (
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleDelete(row.id, `${row.animalType} — Plant ${row.plantId}`)}
                                                    disabled={removeMutation.isPending}
                                                    aria-label={`Delete registration for ${row.animalType}, Plant ${row.plantId}`}
                                                    className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:text-rust disabled:opacity-40"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        ) : null}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {removeMutation.isError ? (
                <p className="mt-3 text-sm text-rust">{removeMutation.error.message}</p>
            ) : null}
        </div>
    );
}
