import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TRPCClientError } from '@trpc/client';
import { apiClient, RouterOutputs } from '../../lib/trpc';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/primitives';

/**
 * Public, unauthenticated landing page for the manager's emailed payroll
 * approval link. The run id + one-time code are the sole credential.
 *
 * This page only ever DISPLAYS the summary — Supabase Edge Functions force
 * every GET HTML response to text/plain (a platform restriction, not fixable
 * in that function's own code), so the manager-facing button has to be
 * rendered from a normal web host instead. The actual approve mutation
 * (verifying the code, flipping the run to APPROVED) still happens in the
 * payment-agent's Edge Function via the form's real cross-origin POST below —
 * that part already renders and works correctly, only GET was broken.
 *
 * Uses the vanilla apiClient (imperative, outside the React Query hook tree)
 * rather than trpc.payroll.approvalContext.useMutation() — the hook form's
 * mutation observer here never settled after a genuinely successful response,
 * so this sidesteps that entirely with a plain fetch-once-on-mount pattern.
 */

type ApprovalContext = RouterOutputs['payroll']['approvalContext'];

const money = (cents: number, currency: string): string =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(cents / 100);

const APPROVE_ENDPOINT = import.meta.env.VITE_PAYROLL_APPROVE_URL as string | undefined;

export default function ApprovePage() {
    const [searchParams] = useSearchParams();
    const runId = searchParams.get('run') ?? '';
    const code = searchParams.get('code') ?? '';

    const [context, setContext] = useState<ApprovalContext | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // StrictMode-double-invoke guard — this is a rate-limited endpoint, same
    // reasoning as BankDetailsPage's bankLinkContext call.
    const requested = useRef(false);
    useEffect(() => {
        if (!runId || !code || requested.current) return;
        requested.current = true;
        apiClient.payroll.approvalContext
            .mutate({ runId, code })
            .then(setContext)
            .catch((e: unknown) => {
                setError(e instanceof TRPCClientError ? e.message : 'This approval link is not valid.');
            })
            .finally(() => setLoading(false));
    }, [runId, code]);

    if (!runId || !code) {
        return (
            <Shell>
                <h1 className="font-display text-lg font-extrabold text-olive-deep">Link not valid</h1>
            </Shell>
        );
    }

    if (loading) {
        return (
            <Shell>
                <p className="text-center text-sm text-muted">Checking your link…</p>
            </Shell>
        );
    }

    if (error || !context) {
        return (
            <Shell>
                <Icon name="badge" width={28} height={28} className="mx-auto mb-3 text-muted" />
                <h1 className="text-center font-display text-lg font-extrabold text-olive-deep">
                    {error ?? 'This approval link is not valid.'}
                </h1>
            </Shell>
        );
    }

    if (context.status !== 'DRAFT') {
        return (
            <Shell>
                <h1 className="font-display text-lg font-extrabold text-olive-deep">
                    Run {context.period} is {context.status}
                </h1>
                <p className="mt-2 text-sm text-muted">Nothing to approve — this link has already been actioned.</p>
            </Shell>
        );
    }

    if (!APPROVE_ENDPOINT) {
        return (
            <Shell>
                <p className="text-center text-sm text-rust">
                    Approval submission is not configured (VITE_PAYROLL_APPROVE_URL missing).
                </p>
            </Shell>
        );
    }

    return (
        <Shell>
            <h1 className="font-display text-lg font-extrabold text-olive-deep">Approve payroll {context.period}</h1>
            <p className="mt-2 text-sm text-ink">
                <strong>{context.totalEmployees}</strong> employee(s) ·{' '}
                <strong>{money(context.totalGrossCents, context.currency)}</strong>
            </p>
            <p className="mt-1 text-sm text-muted">
                Review the emailed breakdown, then confirm. This releases payment after approval.
            </p>
            {/* Real cross-origin form POST straight to the payment-agent's Edge
                Function — that endpoint already verifies the code and flips the
                run to APPROVED correctly; this page never touches that logic. */}
            <form method="POST" action={APPROVE_ENDPOINT} className="mt-5">
                <input type="hidden" name="run" value={runId} />
                <input type="hidden" name="code" value={code} />
                <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-live py-3.5 text-sm font-semibold text-canvas transition-colors hover:opacity-90"
                >
                    <Icon name="check" width={16} height={16} />
                    Approve & release
                </button>
            </form>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
            <div className="w-full max-w-lg">
                <Card className="p-6">{children}</Card>
            </div>
        </main>
    );
}
