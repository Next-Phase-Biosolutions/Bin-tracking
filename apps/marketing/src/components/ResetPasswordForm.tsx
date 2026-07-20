import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/validation';

const field =
    'w-full rounded-xl border border-edge bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none';

const fieldErrorText = 'mt-1.5 text-xs text-rust';

type SessionState = 'loading' | 'ready' | 'invalid';

export function ResetPasswordForm() {
    const navigate = useNavigate();
    const [sessionState, setSessionState] = useState<SessionState>('loading');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        // Clear the hash right away regardless of outcome — never leave
        // recovery tokens sitting in the URL.
        window.history.replaceState(null, '', window.location.pathname);

        if (!accessToken || !refreshToken) {
            setSessionState('invalid');
            return;
        }

        (async () => {
            const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            setSessionState(sessionError ? 'invalid' : 'ready');
        })();
    }, []);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const passwordIssue = validatePassword(password);
        const confirmIssue = password !== confirmPassword ? 'Passwords do not match.' : null;
        setPasswordError(passwordIssue);
        setConfirmError(confirmIssue);
        if (passwordIssue || confirmIssue) return;

        setIsSubmitting(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw new Error(updateError.message);
            await supabase.auth.signOut();
            navigate('/login', { replace: true, state: { passwordReset: true } });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update your password. Please try again.');
            setIsSubmitting(false);
        }
    }

    if (sessionState === 'loading') {
        return <p className="text-sm text-muted">Verifying your link…</p>;
    }

    if (sessionState === 'invalid') {
        return (
            <div className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-4 text-sm text-ink">
                <p className="font-semibold text-rust">This link is invalid or has expired</p>
                <p className="mt-1">Request a new reset link from Settings, then use it within a few minutes.</p>
            </div>
        );
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-olive-deep">
                    New password
                </label>
                <div className="relative">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                        required
                        minLength={8}
                        autoFocus
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
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

            <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold text-olive-deep">
                    Confirm new password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(null); }}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    aria-invalid={confirmError ? true : undefined}
                    className={field}
                />
                {confirmError && <p className={fieldErrorText}>{confirmError}</p>}
            </div>

            {error && <div className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">{error}</div>}

            <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(168,68,42,0.75)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
                {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
        </form>
    );
}
