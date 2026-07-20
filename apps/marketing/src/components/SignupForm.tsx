import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { handoffToApp } from '@/lib/authHandoff';
import { validateEmail, validatePassword, suggestEmailDomain } from '@/lib/validation';
import { OtpInput } from './OtpInput';

const field =
    'w-full rounded-xl border border-edge bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none';

const fieldErrorText = 'mt-1.5 text-xs text-rust';

const RESEND_COOLDOWN_SECONDS = 30;

export function SignupForm() {
    const [email, setEmail] = useState('');
    const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const emailIssue = validateEmail(email);
        const passwordIssue = validatePassword(password);
        const confirmIssue = password !== confirmPassword ? 'Passwords do not match.' : null;
        setEmailError(emailIssue);
        setPasswordError(passwordIssue);
        setConfirmError(confirmIssue);
        if (emailIssue || passwordIssue || confirmIssue) return;

        setIsSubmitting(true);
        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            });
            if (authError) throw new Error(authError.message);
            if (!data.session) {
                // Supabase project requires confirming the email before a
                // session is issued — signUp still succeeds, but there's
                // nothing to hand off to the app yet.
                setNeedsEmailConfirmation(true);
                setResendCooldown(RESEND_COOLDOWN_SECONDS);
                setIsSubmitting(false);
                return;
            }
            handoffToApp(data.session.access_token, data.session.refresh_token);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    }

    async function handleVerify(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setOtpError(null);

        if (otpCode.length !== 6) {
            setOtpError('Enter the 6-digit code from your email.');
            return;
        }

        setIsVerifying(true);
        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otpCode,
                type: 'signup',
            });
            if (verifyError) throw new Error(verifyError.message);
            if (!data.session) throw new Error('No session returned');
            handoffToApp(data.session.access_token, data.session.refresh_token);
            // Navigation continues at the app origin — leave isVerifying true so
            // the button stays disabled through the redirect.
        } catch (err) {
            setOtpError(err instanceof Error ? err.message : 'That code is invalid or expired. Please try again.');
            setIsVerifying(false);
        }
    }

    async function handleResend() {
        setOtpError(null);
        try {
            const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
            if (resendError) throw new Error(resendError.message);
            setOtpCode('');
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
        } catch (err) {
            setOtpError(err instanceof Error ? err.message : 'Could not resend the code. Please try again.');
        }
    }

    if (needsEmailConfirmation) {
        return (
            <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
                <div className="rounded-xl border border-live/30 bg-live/10 px-4 py-4 text-sm text-ink">
                    <p className="font-semibold text-live">Check your email</p>
                    <p className="mt-1">
                        We sent a 6-digit code to <span className="font-semibold">{email}</span>. Enter it below to
                        finish creating your account.
                    </p>
                </div>

                <OtpInput value={otpCode} onChange={(v) => { setOtpCode(v); setOtpError(null); }} disabled={isVerifying} />
                {otpError && <p className={fieldErrorText}>{otpError}</p>}

                <button
                    type="submit"
                    disabled={isVerifying}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(168,68,42,0.75)] disabled:opacity-50 disabled:hover:translate-y-0"
                >
                    {isVerifying ? 'Verifying…' : 'Verify & continue'}
                </button>

                <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={resendCooldown > 0}
                    className="w-full text-center text-xs font-semibold text-muted hover:text-olive-deep disabled:opacity-50"
                >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
            </form>
        );
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-olive-deep">
                    Work email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null); setEmailSuggestion(null); }}
                    onBlur={() => setEmailSuggestion(suggestEmailDomain(email))}
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@yourplant.com"
                    aria-invalid={emailError ? true : undefined}
                    className={field}
                />
                {emailError && <p className={fieldErrorText}>{emailError}</p>}
                {!emailError && emailSuggestion && (
                    <p className="mt-1.5 text-xs text-muted">
                        Did you mean{' '}
                        <button
                            type="button"
                            onClick={() => { setEmail(emailSuggestion); setEmailSuggestion(null); }}
                            className="font-semibold text-rust underline-offset-2 hover:underline"
                        >
                            {emailSuggestion}
                        </button>
                        ?
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-olive-deep">
                    Password
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
                    Confirm password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(null); }}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
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
                {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
        </form>
    );
}
