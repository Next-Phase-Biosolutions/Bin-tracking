import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { trpc } from '../../lib/trpc';

/**
 * Minimal login page wired to AuthContext.login (Supabase email/password),
 * which existed but had no UI consumer before Task 18. After a successful
 * login, auth.bootstrap decides whether to land on the onboarding wizard
 * (org-less account) or the dashboard — same routing rule as SignupPage.
 * Password reset isn't in scope here.
 */
export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const bootstrapMutation = trpc.auth.bootstrap.useMutation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await login(email.trim(), password);
            const { needsOrg } = await bootstrapMutation.mutateAsync();
            navigate(needsOrg ? '/onboarding' : '/app/dashboard', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <div className="mb-6 flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#3d5aa8]/10">
                        <LogIn className="h-6 w-6 text-[#3d5aa8]" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Log in</h1>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 text-left">
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
                        <input
                            type="email"
                            value={email}
                            required
                            autoFocus
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
                        <input
                            type="password"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
                        />
                    </label>

                    {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
                    >
                        {isSubmitting ? 'Logging in…' : 'Log in'}
                    </button>
                </form>

                <p className="mt-6 text-sm text-gray-600">
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="font-semibold text-[#3d5aa8] hover:underline">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}
