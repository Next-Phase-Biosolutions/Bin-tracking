import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { trpc } from '../../lib/trpc';

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
            <CenteredCard>
                <h1 className="text-xl font-bold text-gray-900">Invalid invitation link</h1>
                <p className="mt-3 text-sm text-gray-600">This invite link is missing its token.</p>
            </CenteredCard>
        );
    }

    if (loading || (user && !error)) {
        return <CenteredCard>Joining your team…</CenteredCard>;
    }

    // Already logged in but the accept call itself failed (expired/invalid/
    // already-accepted token) — no signup/login form applies here.
    if (user && error) {
        return (
            <CenteredCard>
                <h1 className="text-xl font-bold text-gray-900">Couldn&apos;t join</h1>
                <p className="mt-3 text-sm text-red-700">{error}</p>
            </CenteredCard>
        );
    }

    if (needsEmailConfirmation) {
        return (
            <CenteredCard>
                <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
                <p className="mt-3 text-sm text-gray-600">
                    We sent a confirmation link to <span className="font-semibold">{email}</span>. Click it, then
                    come back to this invite link to finish joining.
                </p>
            </CenteredCard>
        );
    }

    return (
        <CenteredCard>
            <div className="mb-6 flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#3d5aa8]/10">
                    <UserPlus className="h-6 w-6 text-[#3d5aa8]" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">You've been invited</h1>
                <p className="mt-1 text-sm text-gray-600">
                    {mode === 'signup' ? 'Create an account to join the team.' : 'Log in to join the team.'}
                </p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 text-left">
                <Field label="Email" type="email" value={email} onChange={setEmail} required autoFocus />
                <Field label="Password" type="password" value={password} onChange={setPassword} required />

                {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
                >
                    {isSubmitting ? 'Joining…' : mode === 'signup' ? 'Sign up & join' : 'Log in & join'}
                </button>
            </form>

            <p className="mt-6 text-sm text-gray-600">
                {mode === 'signup' ? 'Already have an account?' : 'New to Bin Tracker?'}{' '}
                <button
                    type="button"
                    onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                    className="font-semibold text-[#3d5aa8] hover:underline"
                >
                    {mode === 'signup' ? 'Log in' : 'Sign up'}
                </button>
            </p>
        </CenteredCard>
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
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            <input
                type={type}
                value={value}
                required={required}
                autoFocus={autoFocus}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
            />
        </label>
    );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                {children}
            </div>
        </div>
    );
}
