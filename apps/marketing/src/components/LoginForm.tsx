import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { handoffToApp } from '@/lib/authHandoff';
import { validateEmail } from '@/lib/validation';

const field =
    'w-full rounded-xl border border-edge bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none';

const fieldErrorText = 'mt-1.5 text-xs text-rust';

export function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const emailIssue = validateEmail(email);
        const passwordIssue = password ? null : 'Password is required.';
        setEmailError(emailIssue);
        setPasswordError(passwordIssue);
        if (emailIssue || passwordIssue) return;

        setIsSubmitting(true);
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (authError) throw new Error(authError.message);
            if (!data.session) throw new Error('No session returned');
            handoffToApp(data.session.access_token, data.session.refresh_token);
            // Navigation continues at the app origin — leave isSubmitting true so
            // the button stays disabled through the redirect.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-olive-deep">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@yourplant.com"
                    aria-invalid={emailError ? true : undefined}
                    className={field}
                />
                {emailError && <p className={fieldErrorText}>{emailError}</p>}
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-semibold text-olive-deep">
                        Password
                    </label>
                </div>
                <div className="relative">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                        required
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        aria-invalid={passwordError ? true : undefined}
                        className={`${field} pr-12`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted hover:text-olive-deep"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>
                {passwordError && <p className={fieldErrorText}>{passwordError}</p>}
            </div>

            {error && <div className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">{error}</div>}

            <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(168,68,42,0.75)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
        </form>
    );
}
