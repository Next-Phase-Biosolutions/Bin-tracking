import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Two-click confirmation without window.confirm: the first click arms the
 * button (it turns into the confirm prompt), the second performs the action.
 * It disarms itself after a few seconds, or when focus leaves it.
 */
export function ConfirmButton({
    children,
    confirmLabel,
    onConfirm,
    disabled,
    ariaLabel,
    tone = 'neutral',
}: {
    children: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    tone?: 'neutral' | 'danger';
}) {
    const [armed, setArmed] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    const base = 'rounded-lg border px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';
    const idle = tone === 'danger' ? 'border-edge bg-white text-rust hover:border-rust hover:bg-rust/5' : 'border-edge bg-white text-olive-deep hover:border-rust hover:bg-rust/5 hover:text-rust';

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={armed ? `${confirmLabel} — click again to confirm` : ariaLabel}
            onBlur={() => setArmed(false)}
            onClick={() => {
                if (!armed) {
                    setArmed(true);
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => setArmed(false), 4000);
                    return;
                }
                clearTimeout(timer.current);
                setArmed(false);
                onConfirm();
            }}
            className={`${base} ${armed ? 'border-rust bg-rust text-canvas' : idle}`}
        >
            {armed ? confirmLabel : children}
        </button>
    );
}
