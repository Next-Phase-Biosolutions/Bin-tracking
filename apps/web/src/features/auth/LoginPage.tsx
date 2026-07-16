import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Logo } from '../../components/app/Logo';
import { Icon } from '../../components/ui/Icon';
import { LiveDot } from '../../components/ui/primitives';
import { useAuth } from '../../context/AuthContext';
import { trpc } from '../../lib/trpc';

const marquee = ['Facility OS', 'Vision AI', 'Butcher Talk', 'Blockchain Verified'];

/**
 * Wired to AuthContext.login (Supabase email/password). After a successful
 * login, auth.bootstrap decides whether to land on the onboarding wizard
 * (org-less account) or the dashboard — same routing rule as SignupPage.
 */
export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const bootstrapMutation = trpc.auth.bootstrap.useMutation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
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
        <main className="min-h-screen lg:grid lg:grid-cols-2">
            {/* Brand panel */}
            <aside className="relative hidden overflow-hidden bg-olive-deep p-12 text-bone lg:flex lg:flex-col lg:justify-between">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark" />
                <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-rust/15 blur-3xl" />
                <Logo variant="light" className="relative h-9 w-auto" />
                <div className="relative">
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-bone/20 bg-white/5 px-3 py-1.5">
                        <LiveDot />
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-bone/70">Plant 01 · online</span>
                    </p>
                    <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-bone">
                        The whole plant,
                        <br />
                        online and proven.
                    </h1>
                    <p className="mt-5 max-w-sm text-lg leading-relaxed text-bone-light/80">
                        Sign in to your facility operating system — live zones, voice capture, compliance, and
                        recovery, all in one connected view.
                    </p>
                </div>
                <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-bone/45">
                    {marquee.map((m, i) => (
                        <span key={m} className="flex items-center gap-4">
                            {i > 0 && <span className="text-bone/25">·</span>}
                            {m}
                        </span>
                    ))}
                </div>
            </aside>

            {/* Form */}
            <section className="relative flex min-h-screen items-center justify-center px-6 py-12">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-50 lg:hidden" />
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="relative w-full max-w-md"
                >
                    <Logo variant="dark" className="mb-8 h-8 w-auto lg:hidden" />
                    <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-rust">Facility portal</p>
                    <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-olive-deep">Sign in</h2>
                    <p className="mt-2 text-sm text-muted">Access your live facility dashboard.</p>

                    <form onSubmit={(e) => void handleSubmit(e)} className="mt-7 space-y-4">
                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-olive-deep">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                required
                                autoFocus
                                autoComplete="email"
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@yourplant.com"
                                className="w-full rounded-xl border border-edge bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="pw" className="mb-1.5 block text-xs font-semibold text-olive-deep">Password</label>
                            <div className="relative">
                                <input
                                    id="pw"
                                    type={show ? 'text' : 'password'}
                                    value={password}
                                    required
                                    autoComplete="current-password"
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full rounded-xl border border-edge bg-white px-4 py-3 pr-12 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShow((s) => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted hover:text-olive-deep"
                                >
                                    {show ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {error && <div className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">{error}</div>}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            <Icon name="arrow" width={16} height={16} />
                            {isSubmitting ? 'Entering…' : 'Enter facility'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-muted">
                        Don&apos;t have an account?{' '}
                        <Link to="/signup" className="font-semibold text-rust hover:underline">
                            Sign up
                        </Link>
                    </p>
                </motion.div>
            </section>
        </main>
    );
}
