/** Shared labelled text input for the employee forms (register + bank details). */
export interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    /** Shown under the input — a validation message, or "where to find this". */
    hint?: string;
    error?: boolean;
    inputMode?: 'text' | 'numeric';
    maxLength?: number;
    autoComplete?: string;
}

export function Field({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    required,
    hint,
    error = false,
    inputMode,
    maxLength,
    autoComplete,
}: FieldProps) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-olive-deep">
                {label}
                {required && <span className="text-rust"> *</span>}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                placeholder={placeholder}
                inputMode={inputMode}
                maxLength={maxLength}
                autoComplete={autoComplete}
                aria-invalid={error || undefined}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink focus:outline-none ${
                    error ? 'border-rust focus:border-rust' : 'border-edge focus:border-rust'
                }`}
            />
            {hint && <span className={`mt-1 block text-xs ${error ? 'text-rust' : 'text-muted'}`}>{hint}</span>}
        </label>
    );
}
