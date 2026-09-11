import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TRPCClientError } from '@trpc/client';
import { apiClient, trpc, RouterOutputs } from '../../lib/trpc';
import { Icon } from '../../components/ui/Icon';
import { Card, Button } from '../../components/ui/primitives';
import { Field } from './Field';

type BankLinkContext = RouterOutputs['employee']['bankLinkContext'];

/**
 * Public, unauthenticated page where an employee submits their OWN bank
 * details. The link token is the sole credential — there is no login here,
 * because employees are QR-badge records, not user accounts.
 *
 * Three steps: enter → review → done. The review step is the point of the
 * whole page: server validation catches a wrong-LENGTH number, but only a
 * human reading it back catches 12345 typed as 12354, and that typo becomes a
 * failed bank transfer days later.
 */

type Step = 'form' | 'review' | 'done';

interface FormState {
    bankAccount: string;
    accountHolderName: string;
    bankName: string;
    bankTransit: string;
    bankInstitution: string;
    email: string;
}

const EMPTY_FORM: FormState = {
    bankAccount: '',
    accountHolderName: '',
    bankName: '',
    bankTransit: '',
    bankInstitution: '',
    email: '',
};

/**
 * The same normalization the server applies before validating. Running it here
 * — at Next, not at submit — is what makes the review screen honest: the
 * employee reviews the digits that will actually be stored, not the dashes
 * they copied off their cheque.
 */
function stripSeparators(value: string): string {
    return value.replace(/[\s-]/g, '');
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!/^\d{7,12}$/.test(form.bankAccount)) errors.bankAccount = 'Must be 7 to 12 digits';
    if (!form.accountHolderName.trim()) errors.accountHolderName = 'Required — as printed on the account';
    if (!form.bankName.trim()) errors.bankName = 'Required — e.g. TD Canada Trust';
    if (!/^\d{5}$/.test(form.bankTransit)) errors.bankTransit = 'Must be exactly 5 digits';
    if (!/^\d{3}$/.test(form.bankInstitution)) errors.bankInstitution = 'Must be exactly 3 digits';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address';
    return errors;
}

export default function BankDetailsPage() {
    const { token = '' } = useParams<{ token: string }>();
    const [step, setStep] = useState<Step>('form');
    const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

    const submitMutation = trpc.employee.submitBankDetails.useMutation({
        onSuccess: () => setStep('done'),
    });

    const [context, setContext] = useState<BankLinkContext | null>(null);
    const [contextError, setContextError] = useState<string | null>(null);
    const [contextLoading, setContextLoading] = useState(true);

    // The token lives in the URL path, so it's resolved via a POST (mutation)
    // rather than a query — a tRPC query would put it in the query string and
    // straight into the server's access logs.
    //
    // Uses the vanilla apiClient (imperative, outside the React Query hook
    // tree) rather than trpc.employee.bankLinkContext.useMutation() — the
    // hook form's mutation observer here never settled after a genuinely
    // successful response (same issue found and fixed on ApprovePage), so
    // this sidesteps it with a plain fetch-once-on-mount pattern instead.
    //
    // The ref guard is required, not defensive: this is a rate-limited
    // endpoint (20/hour), so a duplicate call must never fire.
    const requested = useRef(false);
    useEffect(() => {
        if (!token || requested.current) return;
        requested.current = true;
        apiClient.employee.bankLinkContext
            .mutate({ token })
            .then((data) => {
                setContext(data);
                // Prefill the address the link was sent to. Without this, a
                // typo on a blank field silently overwrites the employer's
                // good contact email for this employee on submit.
                setForm((prev) => ({ ...prev, email: prev.email || data.email }));
            })
            .catch((e: unknown) => {
                setContextError(
                    e instanceof TRPCClientError
                        ? e.message
                        : 'Bank details links work once and expire after 7 days. Ask your employer to send a new one.',
                );
            })
            .finally(() => setContextLoading(false));
    }, [token]);

    const update = (field: keyof FormState, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleNext = (event: React.FormEvent) => {
        event.preventDefault();
        // Normalize first, then validate — "700-1234" is a valid 7-digit
        // account, not an 8-character rejection.
        const normalized: FormState = {
            ...form,
            bankAccount: stripSeparators(form.bankAccount),
            accountHolderName: form.accountHolderName.trim(),
            bankName: form.bankName.trim(),
            bankTransit: stripSeparators(form.bankTransit),
            bankInstitution: stripSeparators(form.bankInstitution),
            email: form.email.trim(),
        };
        const found = validate(normalized);
        setForm(normalized);
        setErrors(found);
        if (Object.keys(found).length === 0) setStep('review');
    };

    if (contextLoading) {
        return <Shell><p className="text-center text-muted">Checking your link…</p></Shell>;
    }

    if (contextError || !context) {
        return (
            <Shell>
                <div className="text-center">
                    <Icon name="badge" width={28} height={28} className="mx-auto mb-3 text-muted" />
                    <h1 className="font-display text-lg font-extrabold text-olive-deep">This link is no longer valid</h1>
                    <p className="mt-2 text-sm text-muted">
                        Bank details links work once and expire after 7 days. Ask your employer to send a new one.
                    </p>
                </div>
            </Shell>
        );
    }

    if (step === 'done') {
        return (
            <Shell>
                <div className="text-center">
                    <Icon name="check" width={32} height={32} className="mx-auto mb-3 text-live" />
                    <h1 className="font-display text-lg font-extrabold text-olive-deep">Bank details received</h1>
                    <p className="mt-2 text-sm text-muted">
                        Thanks{context ? `, ${context.employeeFullName}` : ''}. Your pay will be deposited to the account
                        ending in <strong>{form.bankAccount.slice(-4)}</strong>. You can close this page — this link has
                        now been used.
                    </p>
                </div>
            </Shell>
        );
    }

    if (step === 'review') {
        return (
            <Shell org={context?.organizationName} employee={context?.employeeFullName}>
                <h2 className="font-display text-base font-extrabold text-olive-deep">Please check these carefully</h2>
                <p className="mt-1 text-sm text-muted">
                    Your pay will be deposited using exactly these numbers. Nothing has been sent yet.
                </p>

                <dl className="mt-5 divide-y divide-edge/50 rounded-xl border border-edge bg-white">
                    <ReviewRow label="Account number" value={form.bankAccount} mono />
                    <ReviewRow label="Account name" value={form.accountHolderName} />
                    <ReviewRow label="Bank name" value={form.bankName} />
                    <ReviewRow label="Routing number" value={form.bankTransit} mono />
                    <ReviewRow label="Institution number" value={form.bankInstitution} mono />
                    <ReviewRow label="Email" value={form.email} />
                </dl>

                {submitMutation.isError && (
                    <div className="mt-4 rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                        {submitMutation.error.message}
                    </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => setStep('form')}
                        disabled={submitMutation.isPending}
                    >
                        ← Back
                    </Button>
                    <button
                        onClick={() => submitMutation.mutate({ token, ...form })}
                        disabled={submitMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rust py-3 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                    >
                        <Icon name="check" width={16} height={16} />
                        {submitMutation.isPending ? 'Sending…' : 'Confirm & send'}
                    </button>
                </div>
            </Shell>
        );
    }

    return (
        <Shell org={context?.organizationName} employee={context?.employeeFullName}>
            <form onSubmit={handleNext} className="space-y-4" autoComplete="off">
                <Field
                    label="Account number"
                    required
                    value={form.bankAccount}
                    onChange={(v) => update('bankAccount', v)}
                    placeholder="7001234"
                    inputMode="numeric"
                    maxLength={20}
                    hint={errors.bankAccount ?? '7 to 12 digits. Spaces and dashes are fine.'}
                    error={Boolean(errors.bankAccount)}
                    autoComplete="off"
                />

                <Field
                    label="Account name"
                    required
                    value={form.accountHolderName}
                    onChange={(v) => update('accountHolderName', v)}
                    placeholder="Jane Doe"
                    hint={errors.accountHolderName ?? 'Exactly as it appears on your bank account'}
                    error={Boolean(errors.accountHolderName)}
                    autoComplete="off"
                />

                <Field
                    label="Bank name"
                    required
                    value={form.bankName}
                    onChange={(v) => update('bankName', v)}
                    placeholder="TD Canada Trust"
                    hint={errors.bankName}
                    error={Boolean(errors.bankName)}
                    autoComplete="off"
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                        label="Routing number"
                        required
                        value={form.bankTransit}
                        onChange={(v) => update('bankTransit', v)}
                        placeholder="12345"
                        inputMode="numeric"
                        maxLength={8}
                        hint={errors.bankTransit ?? '5 digits — identifies your branch'}
                        error={Boolean(errors.bankTransit)}
                        autoComplete="off"
                    />
                    <Field
                        label="Institution number"
                        required
                        value={form.bankInstitution}
                        onChange={(v) => update('bankInstitution', v)}
                        placeholder="004"
                        inputMode="numeric"
                        maxLength={5}
                        hint={errors.bankInstitution ?? '3 digits — identifies your bank'}
                        error={Boolean(errors.bankInstitution)}
                        autoComplete="off"
                    />
                </div>

                <Field
                    label="Email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(v) => update('email', v)}
                    placeholder="jane@example.com"
                    hint={errors.email ?? 'Where deposit notifications are sent'}
                    error={Boolean(errors.email)}
                    autoComplete="off"
                />

                <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust py-3.5 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90"
                >
                    Next → review
                </button>

                <p className="text-center text-xs text-muted">
                    Your account and routing numbers are encrypted before they're stored and never shown to your
                    employer — they only see your bank name and the last 4 digits of your account.
                </p>
            </form>
        </Shell>
    );
}

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            {/* Shown in FULL, deliberately unmasked: catching a mistyped digit
                is the entire purpose of this screen, and it's the employee's
                own data on their own device. */}
            <dd className={`text-right text-sm text-ink ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</dd>
        </div>
    );
}

function Shell({ children, org, employee }: { children: React.ReactNode; org?: string; employee?: string }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
            <div className="w-full max-w-lg">
                {(org || employee) && (
                    <header className="mb-5 text-center">
                        <p className="kicker">{org ?? 'Direct deposit'}</p>
                        <h1 className="mt-1 font-display text-2xl font-extrabold text-olive-deep">
                            Direct deposit details
                        </h1>
                        {employee && <p className="mt-1 text-sm text-muted">for {employee}</p>}
                    </header>
                )}
                <Card className="p-6">{children}</Card>
            </div>
        </main>
    );
}
