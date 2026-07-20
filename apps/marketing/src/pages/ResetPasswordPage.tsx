import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/atoms';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export default function ResetPasswordPage() {
    return (
        <main className="min-h-screen lg:grid lg:grid-cols-2">
            {/* Brand panel */}
            <aside className="relative hidden overflow-hidden bg-olive-deep p-12 text-bone lg:flex lg:flex-col lg:justify-between">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark" />
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-rust/15 blur-3xl"
                />

                <Link to="/" className="relative inline-flex" aria-label="Next Phase BioSolutions home">
                    <Logo variant="light" className="h-9 w-auto" />
                </Link>

                <div className="relative">
                    <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-bone">
                        Set a new
                        <br />
                        password.
                    </h1>
                    <p className="mt-5 max-w-sm text-lg leading-relaxed text-bone/70">
                        Choose a new password to get back into your facility dashboard.
                    </p>
                </div>
            </aside>

            {/* Form panel */}
            <section className="relative flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-50 lg:hidden" />
                <div className="relative w-full max-w-md">
                    {/* mobile logo */}
                    <Link to="/" className="mb-8 inline-flex lg:hidden" aria-label="Next Phase BioSolutions home">
                        <Logo className="h-8 w-auto" />
                    </Link>

                    <p className="eyebrow text-rust">Facility portal</p>
                    <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-olive-deep">
                        Reset your password
                    </h2>
                    <p className="mt-2 text-sm text-muted">Enter a new password for your account.</p>

                    <div className="mt-7">
                        <ResetPasswordForm />
                    </div>

                    <p className="mt-7 border-t border-edge/70 pt-6 text-sm">
                        <Link to="/login" className="text-muted underline-offset-4 hover:text-olive-deep hover:underline">
                            ← Back to login
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    );
}
