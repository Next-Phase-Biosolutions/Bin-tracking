import { useEffect, useState, type FormEvent } from 'react';
import { trpc } from '../../lib/trpc';
import { Card, Button, Badge } from '../../components/ui/primitives';

const inputCls =
    'w-full rounded-lg border border-edge/80 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-olive focus:bg-white focus:outline-none';

const fieldLabel = 'mb-1.5 block font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted';

// Curated list — the payout runs in Canada, so offer the Canadian zones rather
// than 400+ IANA entries. The backend still validates the full IANA set.
const TIMEZONES = [
    { value: 'America/Toronto', label: 'Eastern (Toronto)' },
    { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
    { value: 'America/Regina', label: 'Saskatchewan (Regina)' },
    { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
    { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
    { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
    { value: 'America/St_Johns', label: 'Newfoundland (St. John’s)' },
];

const DEFAULT_TZ = 'America/Toronto';

/** Dollars string → integer cents, guarding float drift (15.10 → 1510, not 1510.0000002). */
function dollarsToCents(dollars: string): number {
    return Math.round(Number.parseFloat(dollars) * 100);
}

/**
 * Org payroll config (rate / timezone / manager email). Admin-only surface —
 * rendered by SettingsPage inside its ADMIN + PAYROLL-module gate. Currency is
 * fixed to CAD (the payout processor is Canadian).
 */
export function PayrollSettingsCard() {
    const utils = trpc.useUtils();
    const settings = trpc.settings.get.useQuery();

    const [rate, setRate] = useState('');
    const [timezone, setTimezone] = useState(DEFAULT_TZ);
    const [managerEmail, setManagerEmail] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);

    // Prefill once the saved row arrives (or resets after an external change).
    useEffect(() => {
        if (!settings.data) return;
        setRate((settings.data.flatHourlyRateCents / 100).toFixed(2));
        setTimezone(settings.data.companyTimezone);
        setManagerEmail(settings.data.managerEmail ?? '');
    }, [settings.data]);

    const update = trpc.settings.update.useMutation({
        onSuccess: () => void utils.settings.get.invalidate(),
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setEmailError(null);

        const cents = dollarsToCents(rate);
        if (!Number.isInteger(cents) || cents <= 0) {
            setEmailError('Enter a valid hourly rate.');
            return;
        }
        // Empty → null (the validator rejects ""), otherwise the trimmed address.
        const email = managerEmail.trim() === '' ? null : managerEmail.trim();

        update.mutate({ flatHourlyRateCents: cents, currency: 'CAD', companyTimezone: timezone, managerEmail: email });
    };

    const savedManagerMissing = settings.data != null && !settings.data.managerEmail;

    return (
        <Card>
            <div className="flex items-end justify-between gap-3 border-b border-edge/50 px-6 py-5">
                <div>
                    <p className="kicker">Payroll</p>
                    <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-olive-deep">
                        Pay & approvals
                    </h2>
                </div>
                {savedManagerMissing ? <Badge tone="warn">Manager email needed</Badge> : null}
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
                {savedManagerMissing ? (
                    <p className="mb-5 rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-xs leading-relaxed text-warn">
                        Payroll approval emails won’t send until you set a manager email below.
                    </p>
                ) : null}

                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                        <span className={fieldLabel}>Hourly rate (CAD)</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            className={inputCls}
                            placeholder="15.00"
                        />
                        <span className="mt-1.5 block text-xs text-muted">Default rate; overridden per employee where set.</span>
                    </label>

                    <label className="block">
                        <span className={fieldLabel}>Timezone</span>
                        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                            {TIMEZONES.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                        <span className="mt-1.5 block text-xs text-muted">Used to bucket shifts into the right month.</span>
                    </label>

                    <label className="block sm:col-span-2">
                        <span className={fieldLabel}>Manager email (payroll approvals)</span>
                        <input
                            type="email"
                            value={managerEmail}
                            onChange={(e) => setManagerEmail(e.target.value)}
                            className={inputCls}
                            placeholder="manager@yourplant.com"
                        />
                    </label>
                </div>

                {emailError ? <p className="mt-4 text-sm text-rust">{emailError}</p> : null}
                {update.isError ? <p className="mt-4 text-sm text-rust">{update.error.message}</p> : null}
                {update.isSuccess ? <p className="mt-4 text-sm text-live">Saved.</p> : null}

                <div className="mt-6 border-t border-edge/40 pt-5">
                    <Button type="submit" disabled={update.isPending || settings.isLoading}>
                        {update.isPending ? 'Saving…' : 'Save payroll settings'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
