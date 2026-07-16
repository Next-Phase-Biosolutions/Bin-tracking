import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { setAuthToken, trpc } from '../../lib/trpc';

/**
 * Lands here after a real login/signup on the marketing site's own origin
 * hands its Supabase session across via a URL hash fragment (never a query
 * param — fragments are never sent to a server or logged in a Referer
 * header). Sets the session locally, clears the hash immediately so the
 * tokens don't linger in the address bar or browser history, then follows
 * the same bootstrap-based redirect LoginPage/SignupPage use.
 */
export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const bootstrapMutation = trpc.auth.bootstrap.useMutation();
    const [error, setError] = useState<string | null>(null);
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        // Clear the hash right away regardless of outcome — never leave
        // tokens sitting in the URL.
        window.history.replaceState(null, '', window.location.pathname);

        if (!accessToken || !refreshToken) {
            navigate('/login', { replace: true });
            return;
        }

        (async () => {
            try {
                const { data, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (sessionError) throw new Error(sessionError.message);
                if (!data.session) throw new Error('No session returned');
                setAuthToken(data.session.access_token);

                const { needsOrg } = await bootstrapMutation.mutateAsync();
                navigate(needsOrg ? '/onboarding' : '/app/dashboard', { replace: true });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
                <p className="text-sm text-rust">{error}</p>
                <button
                    onClick={() => navigate('/login', { replace: true })}
                    className="rounded-xl bg-olive-deep px-5 py-2.5 text-sm font-semibold text-bone-light hover:bg-olive-deep/90"
                >
                    Back to login
                </button>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas text-muted">
            <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
        </div>
    );
}
