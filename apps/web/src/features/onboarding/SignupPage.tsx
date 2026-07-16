import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { trpc } from '../../lib/trpc';

/**
 * Self-serve signup entry point (Task 18). Collects email/password only —
 * Supabase Auth handles the credential creation client-side. Once a session
 * exists, the first authenticated call is auth.bootstrap, which creates the
 * local User row and reports whether an org still needs to be created; the
 * result decides whether we land on the onboarding wizard or straight on
 * the dashboard (a returning email that already has an org, re-signing up
 * would 409 from Supabase before we ever get here — this branch mainly
 * matters after a page refresh mid-flow).
 */
export default function SignupPage() {
    const navigate = useNavigate();
    const { signup } = useAuth();
    const bootstrapMutation = trpc.auth.bootstrap.useMutation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { needsEmailConfirmation: pending } = await signup(email.trim(), password);
            if (pending) {
                setNeedsEmailConfirmation(true);
                return;
            }

            const { needsOrg } = await bootstrapMutation.mutateAsync();
            navigate(needsOrg ? '/onboarding' : '/app/dashboard', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (needsEmailConfirmation) {
        return (
            <CenteredCard>
                <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
                <p className="mt-3 text-sm text-gray-600">
                    We sent a confirmation link to <span className="font-semibold">{email}</span>. Click it to
                    finish creating your account.
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
                <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
                <p className="mt-1 text-sm text-gray-600">Start tracking bins in minutes.</p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 text-left">
                <Field label="Work email" type="email" value={email} onChange={setEmail} required autoFocus />
                <Field label="Password" type="password" value={password} onChange={setPassword} required />
                <Field
                    label="Confirm password"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    required
                />

                {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
                >
                    {isSubmitting ? 'Creating account…' : 'Sign up'}
                </button>
            </form>

            <p className="mt-6 text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-[#3d5aa8] hover:underline">
                    Log in
                </Link>
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
