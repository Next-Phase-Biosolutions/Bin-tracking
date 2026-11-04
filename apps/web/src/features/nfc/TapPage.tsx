import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { phoneClient } from '../../lib/phone-client';
import { InAppBrowserBanner } from './InAppBrowserBanner';
import { TAP_ERRORS, appCodeOf, isOverloadError, isTransientError } from './errors';
import { toTapView, type TapView } from './tap-view';

type View =
    | { kind: 'loading' }
    | { kind: 'waking' }
    | { kind: 'result'; view: TapView }
    | { kind: 'error'; title: string; detail: string };

/**
 * Retry rules, chosen so a retry can never record a second punch:
 *  - HTTP 429 (rate limit, SERVER_BUSY) is raised before anything is recorded, so it is
 *    always safe to repeat, up to MAX_RETRIES times.
 *  - Any other transient failure (dropped network, gateway error) is AMBIGUOUS: the tap
 *    may have been recorded and only the response lost. Repeating it is safe only if the
 *    server will read it as a double-tap, i.e. it lands inside its 5 s debounce window of
 *    the first attempt (which was recorded no earlier than it was sent). So ambiguous
 *    failures are retried only within AMBIGUOUS_RETRY_WINDOW_MS of the first attempt;
 *    after that the employee is told to check and tap again themselves.
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;
const AMBIGUOUS_RETRY_WINDOW_MS = 3000;

const TONE: Record<TapView['tone'] | 'loading' | 'error', string> = {
    loading: 'bg-canvas text-olive-deep',
    in: 'bg-olive text-bone-light',
    out: 'bg-olive-deep text-bone-light',
    registered: 'bg-olive text-bone-light',
    warn: 'bg-warn text-ink',
    error: 'bg-rust text-bone-light',
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** /app/tap?card=<id> — opened by every physical tap. Resolves itself on load: no buttons. */
export default function TapPage({ retryDelayMs = RETRY_DELAY_MS }: { retryDelayMs?: number }) {
    const [params] = useSearchParams();
    const cardId = params.get('card') ?? '';
    const [view, setView] = useState<View>({ kind: 'loading' });
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return; // StrictMode runs effects twice in dev
        started.current = true;
        if (!cardId) {
            setView({ kind: 'error', title: 'No card detected', detail: 'Hold your phone against an NFC card to clock in or out.' });
            return;
        }
        void (async () => {
            const startedAt = Date.now();
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const result = await phoneClient.attendance.tap.mutate({ cardId });
                    setView({ kind: 'result', view: toTapView(result) });
                    return;
                } catch (e) {
                    const overloaded = isOverloadError(e);
                    const safeToRepeat = overloaded || (isTransientError(e) && Date.now() - startedAt < AMBIGUOUS_RETRY_WINDOW_MS);
                    if (safeToRepeat && attempt < MAX_RETRIES) {
                        setView({ kind: 'waking' });
                        await sleep(retryDelayMs);
                        continue;
                    }
                    const code = appCodeOf(e) ?? (isTransientError(e) && !overloaded ? 'UNCONFIRMED' : '');
                    const known = TAP_ERRORS[code];
                    setView({
                        kind: 'error',
                        title: known?.title ?? 'Something went wrong',
                        detail: known?.detail ?? 'Something went wrong. Please tap the card again.',
                    });
                    return;
                }
            }
        })();
    }, [cardId, retryDelayMs]);

    if (view.kind === 'loading' || view.kind === 'waking') {
        return (
            <Screen tone="loading" busy>
                <div className="text-5xl" aria-hidden>⏳</div>
                <h1 className="font-display text-2xl font-extrabold">{view.kind === 'waking' ? 'Waking up, please wait…' : 'Checking…'}</h1>
            </Screen>
        );
    }
    if (view.kind === 'error') {
        return (
            <Screen tone="error" role="alert">
                <div className="text-5xl" aria-hidden>⛔</div>
                <h1 className="font-display text-2xl font-extrabold">{view.title}</h1>
                <p className="max-w-sm text-base opacity-95">{view.detail}</p>
                <div className="mt-2 w-full max-w-sm"><InAppBrowserBanner /></div>
            </Screen>
        );
    }
    return (
        <Screen tone={view.view.tone} role="status">
            <div className="text-5xl" aria-hidden>{view.view.icon}</div>
            <h1 className="font-display text-2xl font-extrabold">{view.view.title}</h1>
            {view.view.detail && <p className="max-w-sm text-base opacity-95">{view.view.detail}</p>}
        </Screen>
    );
}

function Screen({
    tone,
    role,
    busy,
    children,
}: {
    tone: keyof typeof TONE;
    role?: 'status' | 'alert';
    busy?: boolean;
    children: React.ReactNode;
}) {
    // <main> stays the page landmark; the live region (status/alert) is the element inside it.
    return (
        <main className={`flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center ${TONE[tone]}`}>
            <div role={role} aria-busy={busy} className="flex flex-col items-center gap-3">
                {children}
            </div>
        </main>
    );
}
