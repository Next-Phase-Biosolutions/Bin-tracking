import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { phoneClient } from '../../lib/phone-client';
import { InAppBrowserBanner } from './InAppBrowserBanner';
import { TAP_ERRORS, appCodeOf, isTransientError } from './errors';
import { toTapView, type TapView } from './tap-view';

type View =
    | { kind: 'loading' }
    | { kind: 'waking' }
    | { kind: 'result'; view: TapView }
    | { kind: 'error'; title: string; detail: string };

/**
 * Up to 3 retries on a transient failure (network drop, gateway error, HTTP 429
 * "busy"). Every attempt falls inside the server's 5 s debounce window, so if a
 * response was lost AFTER the tap was recorded, the retry is answered with an
 * echo of that tap and can never toggle a BOTH card a second time.
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;

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
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const result = await phoneClient.attendance.tap.mutate({ cardId });
                    setView({ kind: 'result', view: toTapView(result) });
                    return;
                } catch (e) {
                    if (isTransientError(e) && attempt < MAX_RETRIES) {
                        setView({ kind: 'waking' });
                        await sleep(retryDelayMs);
                        continue;
                    }
                    const known = TAP_ERRORS[appCodeOf(e) ?? ''];
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
    return (
        <main role={role} aria-busy={busy} className={`flex min-h-screen flex-col items-center justify-center gap-3 px-6 py-10 text-center ${TONE[tone]}`}>
            {children}
        </main>
    );
}
