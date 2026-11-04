import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { phoneClient } from '../../lib/phone-client';
import { Card } from '../../components/ui/primitives';
import { InAppBrowserBanner } from './InAppBrowserBanner';
import { REGISTER_ERRORS, appCodeOf } from './errors';

type State =
    | { kind: 'checking' }
    | { kind: 'ready'; employeeName: string }
    | { kind: 'error'; message: string };

/**
 * /app/register?token=… — the employee opens the link their manager gave them.
 * This only marks the browser "mid-registration" (a 10-minute cookie); the phone
 * is bound when they then tap a card, which is what proves they can reach the
 * real device. Public: the single-use token is the only credential.
 */
export default function RegisterPage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [state, setState] = useState<State>(token ? { kind: 'checking' } : { kind: 'error', message: 'This page needs a registration link from your manager.' });
    const started = useRef(false);

    useEffect(() => {
        if (!token || started.current) return; // StrictMode runs effects twice in dev
        started.current = true;
        void (async () => {
            try {
                const { employeeName } = await phoneClient.deviceRegistration.start.mutate({ token });
                setState({ kind: 'ready', employeeName });
            } catch (e) {
                setState({
                    kind: 'error',
                    message: REGISTER_ERRORS[appCodeOf(e) ?? ''] ?? 'We couldn’t check this link right now. Please try again in a moment.',
                });
            }
        })();
    }, [token]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
            <div className="w-full max-w-md">
                <InAppBrowserBanner />
                <Card className="p-6 text-center">
                    {state.kind === 'checking' && (
                        <p role="status" aria-busy="true" className="text-sm text-muted">Checking your link…</p>
                    )}
                    {state.kind === 'ready' && (
                        <div role="status">
                            <div className="text-5xl" aria-hidden>📲</div>
                            <h1 className="mt-3 font-display text-2xl font-extrabold text-olive-deep">Hi {state.employeeName}!</h1>
                            <p className="mt-2 text-base text-ink">Now tap the NFC card with this phone.</p>
                            <p className="mt-1 text-sm text-muted">Hold the back of your phone against the card at the door. That finishes setting up this phone.</p>
                        </div>
                    )}
                    {state.kind === 'error' && (
                        <div role="alert">
                            <div className="text-5xl" aria-hidden>⛔</div>
                            <h1 className="mt-3 font-display text-xl font-extrabold text-rust">Can’t use this link</h1>
                            <p className="mt-2 text-sm text-ink">{state.message}</p>
                        </div>
                    )}
                </Card>
            </div>
        </main>
    );
}
