import { trpc } from '../../lib/trpc';
import { Card, Badge } from '../../components/ui/primitives';

const OPTIONS = [
    {
        value: 'NFC' as const,
        title: 'NFC tags (recommended)',
        detail: 'Employees tap their own registered phone on a wall-mounted tag. Manage tags under NFC Cards and phones under Employees.',
    },
    {
        value: 'QR' as const,
        title: 'QR badge scanner',
        detail: 'A guard scans each employee’s badge with the Employee Scanner. This is the original method; NFC taps are refused while it is selected.',
    },
];

/**
 * Which clock-in method the organization uses. Exactly one is active: the other is
 * switched off, not deleted, so choosing it again is also the rollback. Admin-only,
 * rendered by SettingsPage inside its ADMIN + WORKFORCE gate. Every change is audited.
 */
export function AttendanceMethodCard() {
    const utils = trpc.useUtils();
    const current = trpc.attendance.method.useQuery();
    const set = trpc.settings.setAttendanceMethod.useMutation({
        onSuccess: async () => {
            await utils.attendance.method.invalidate();
            await utils.settings.get.invalidate();
        },
    });
    const active = current.data?.method;

    return (
        <Card className="p-0">
            <div className="flex items-end justify-between gap-3 border-b border-edge/50 px-6 py-5">
                <div>
                    <p className="kicker">Workforce</p>
                    <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-olive-deep">Clock-in method</h2>
                </div>
                {active ? <Badge tone="good">{active === 'NFC' ? 'NFC active' : 'QR active'}</Badge> : null}
            </div>
            <fieldset className="space-y-3 px-6 py-5" disabled={current.isLoading || set.isPending}>
                <legend className="sr-only">Clock-in method</legend>
                {OPTIONS.map((o) => (
                    <label key={o.value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${active === o.value ? 'border-olive bg-olive/5' : 'border-edge/70 hover:border-olive/50'}`}>
                        <input
                            type="radio"
                            name="attendanceMethod"
                            value={o.value}
                            checked={active === o.value}
                            onChange={() => set.mutate({ method: o.value })}
                            className="mt-1"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-ink">{o.title}</span>
                            <span className="mt-0.5 block text-sm text-muted">{o.detail}</span>
                        </span>
                    </label>
                ))}
                {set.isError ? (
                    <p role="alert" className="text-sm text-rust">
                        {set.error.message}
                    </p>
                ) : null}
                <p className="text-xs text-muted">
                    Switching takes effect immediately for everyone. Make sure tags are written and phones registered before choosing NFC, or employees will not be able to clock in.
                </p>
            </fieldset>
        </Card>
    );
}
