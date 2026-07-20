import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

const CODE_LENGTH = 6;

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

/**
 * 6-box one-time-code entry: digit-only, auto-advances, backspace steps
 * back, paste fills all boxes.
 *
 * Digits are local state, not derived fresh from `value` on every render —
 * `value.join('')` collapses empty middle slots (e.g. clearing a mistyped
 * digit in box 3 while boxes 4-6 stay filled), which would otherwise shift
 * every later digit left on the next render. `value` is only used to detect
 * an external reset (parent clearing the code on resend).
 */
export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
    const [digits, setDigits] = useState<string[]>(() => Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? ''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (value === '') setDigits(Array(CODE_LENGTH).fill(''));
    }, [value]);

    function commit(next: string[]) {
        setDigits(next);
        onChange(next.join(''));
    }

    function handleChange(index: number, raw: string) {
        const digit = raw.replace(/\D/g, '').slice(-1);
        const next = digits.slice();
        next[index] = digit;
        commit(next);
        if (digit && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    }

    function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
        if (!pasted) return;
        e.preventDefault();
        const next = Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? '');
        commit(next);
        inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    }

    return (
        <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    disabled={disabled}
                    autoFocus={index === 0}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                    className="h-14 w-full rounded-xl border border-edge bg-white text-center text-xl font-semibold text-ink focus:border-rust focus:outline-none disabled:opacity-50"
                />
            ))}
        </div>
    );
}
