import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { trpc } from '../../lib/trpc';
import { Logo } from '../../components/app/Logo';
import { Icon } from '../../components/ui/Icon';

/**
 * Landing page for an invite link (`/invite/:token`, Task 19). The token is
 * the sole credential the accept call needs — this page's only job is to get
 * the visitor into an authenticated Supabase session (existing login, or a
 * fresh signup for someone new to Bin Tracker) and then call
 * invitation.accept, which resolves org + role from the token server-side.
 *
 * Its own self-contained login/signup form (not the marketing site's) since
 * the invite token has to be consumed in the same step as authenticating.
 */
export default function AcceptInvitePage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, loading, login, signup } = useAuth();
    const acceptMutation = trpc.invitation.accept.useMutation();

    const [mode, setMode] = useState<'signup' | 'login'>('signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const accept = async () => {
        if (!token) return;
        await acceptMutation.mutateAsync({ token });
        navigate('/app/dashboard', { replace: true });
    };

    // Already logged in (e.g. clicked the link in an existing session) —
    // accept immediately, no form needed.
    const requested = useRef(false);
    useEffect(() => {
        if (loading || !user || requested.current) return;
        requested.current = true;
        accept().catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not accept invitation.');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, user]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!token) {
            setError('This invitation link is invalid.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setIsSubmitting(true);
        // login/signup below set `user`, which would ALSO fire the
        // logged-in-already effect's accept() — claim the guard first so
        // only this submit path accepts, not both in a race (the loser
        // would flash "already accepted" for a join that just succeeded).
        requested.current = true;
        try {
            if (mode === 'signup') {
                const { needsEmailConfirmation: pending } = await signup(email.trim(), password);
                if (pending) {
                    setNeedsEmailConfirmation(true);
                    return;
                }
            } else {
                await login(email.trim(), password);
            }
            await accept();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!token) {
        return (
            <ClearanceCard eyebrow="Invalid link">
                <h1 className="font-display text-xl font-extrabold text-olive-deep">Invalid invitation link</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">This invite link is missing its token.</p>
            </ClearanceCard>
        );
    }

    if (loading || (user && !error)) {
        return (
            <ClearanceCard eyebrow="Joining">
                <p className="animate-pulse font-mono text-xs uppercase tracking-eyebrow text-muted">
                    Joining your team…
                </p>
            </ClearanceCard>
        );
    }

    // Already logged in but the accept call itself failed (expired/invalid/
    // already-accepted token) — no signup/login form applies here.
    if (user && error) {
        return (
            <ClearanceCard eyebrow="Clearance failed">
                <h1 className="font-display text-xl font-extrabold text-olive-deep">Couldn&apos;t join</h1>
                <p className="mt-3 text-sm leading-relaxed text-rust">{error}</p>
            </ClearanceCard>
        );
    }

    if (needsEmailConfirmation) {
        return (
            <ClearanceCard eyebrow="One more step">
                <h1 className="font-display text-xl font-extrabold text-olive-deep">Check your email</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                    We sent a confirmation link to <span className="font-semibold text-olive-deep">{email}</span>.
                    Click it, then come back to this invite link to finish joining.
                </p>
            </ClearanceCard>
        );
    }

    return (
        <ClearanceCard eyebrow="Crew invitation">
            <h1 className="font-display text-xl font-extrabold text-olive-deep">You&apos;ve been invited</h1>
            <p className="mt-1.5 text-sm text-muted">
                {mode === 'signup' ? 'Create an account to join the team.' : 'Log in to join the team.'}
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4 text-left">
                <Field label="Email" type="email" value={email} onChange={setEmail} required autoFocus />
                <Field label="Password" type="password" value={password} onChange={setPassword} required />

                {error && (
                    <div className="rounded-lg border border-rust/25 bg-rust/10 px-4 py-3 text-sm text-rust">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rust py-3 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                >
                    {isSubmitting ? 'Joining…' : mode === 'signup' ? 'Sign up & join' : 'Log in & join'}
                    {!isSubmitting && <Icon name="arrow" width={15} height={15} />}
                </button>
            </form>

            <p className="mt-6 text-sm text-muted">
                {mode === 'signup' ? 'Already have an account?' : 'New to Bin Tracker?'}{' '}
                <button
                    type="button"
                    onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                    className="font-semibold text-rust hover:underline"
                >
                    {mode === 'signup' ? 'Log in' : 'Sign up'}
                </button>
            </p>
        </ClearanceCard>
    );
}

interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
    autoFocus?: boolean;
}

function Field({ label, value, onChange, type = 'text', required, autoFocus }: FieldProps) {
    return (
        <label className="block">
            <span className="mb-1.5 block font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                {label}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                autoFocus={autoFocus}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-edge/80 bg-canvas px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-olive focus:bg-white focus:outline-none"
            />
        </label>
    );
}

/**
 * The invite "clearance card": olive header band carrying the brand (same
 * treatment as the app sidebar), white body, on the canvas data-grid
 * texture the rest of the product uses.
 */
function ClearanceCard({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
    return (
        <div className="relative flex min-h-screen items-center justify-center bg-canvas p-6">
            <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-60" />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-edge/70 bg-white shadow-panel">
                <div className="relative border-b border-white/10 bg-olive-deep px-8 py-6">
                    <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
                    <Logo variant="light" className="relative h-7 w-auto" />
                    <p className="relative mt-2 font-mono text-[0.58rem] uppercase tracking-eyebrow text-bone/50">
                        Facility OS · {eyebrow}
                    </p>
                </div>
                <div className="px-8 py-7 text-center">{children}</div>
            </div>
        </div>
    );
}
