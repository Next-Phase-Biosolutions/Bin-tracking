import { useEffect, useRef, useState } from 'react';

/** A read-only value with a Copy button. Falls back to selecting the text when the clipboard is unavailable. */
export function CopyField({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            input.current?.select(); // iOS Safari / insecure context: let the user copy by hand
        }
    };

    return (
        <div className="flex items-center gap-2">
            <input
                ref={input}
                readOnly
                value={value}
                aria-label={label}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-edge bg-bone-light/50 px-3 py-1.5 font-mono text-xs text-ink"
            />
            <button
                type="button"
                onClick={() => void copy()}
                className="shrink-0 rounded-lg border border-edge bg-white px-2.5 py-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-olive-deep transition-colors hover:border-rust hover:text-rust"
            >
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
}
