import { Mic } from 'lucide-react';

/**
 * Review affordances for answers a *blanket* utterance filled ("everything else
 * is compliant") rather than ones the worker named outright.
 *
 * Deliberately quieter than the amber low-confidence flag: a blanket phrase can
 * set 15 answers at once, and 15 amber rows is wallpaper the worker stops
 * reading — which would hide the one value the model was genuinely unsure of.
 */

interface VoiceBlanketBannerProps {
    count: number;
    /** DOM id of the first blanket-filled answer — the jump target. */
    firstId: string | null;
}

export function VoiceBlanketBanner({ count, firstId }: VoiceBlanketBannerProps) {
    if (count === 0) return null;

    const jump = () => {
        if (!firstId) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document
            .getElementById(firstId)
            ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };

    return (
        <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-olive-deep/20 bg-bone-light px-4 py-3"
        >
            <Mic className="h-4 w-4 shrink-0 text-olive-deep" />
            <p className="flex-1 text-sm text-ink">
                Voice set <strong className="font-bold">{count}</strong>{' '}
                {count === 1 ? 'answer' : 'answers'} from a blanket statement — review before
                submitting.
            </p>
            {firstId && (
                <button
                    type="button"
                    onClick={jump}
                    className="shrink-0 rounded-lg border border-olive-deep/25 px-3 py-1.5 text-xs font-semibold text-olive-deep hover:bg-bone"
                >
                    Jump to first
                </button>
            )}
        </div>
    );
}

/** Inline marker on an individual answer the blanket filled. */
export function VoiceBlanketMark() {
    return (
        <span
            title="Set from a blanket voice statement — confirm this"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-olive-deep/70"
        >
            <Mic className="h-3 w-3" />
            voice
        </span>
    );
}
