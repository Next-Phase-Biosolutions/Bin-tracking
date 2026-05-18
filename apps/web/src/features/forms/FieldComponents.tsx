import type { FormField } from '@bin-tracker/types';

interface BaseProps {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}

const labelCls = 'block text-sm font-semibold text-gray-700 mb-1';
const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#043F2E] focus:border-transparent disabled:bg-gray-50';
const errorCls = 'text-red-600 text-xs mt-1';

export function TextInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
                type="text"
                className={inputCls}
                placeholder={field.placeholder ?? ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function TextareaInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder={field.placeholder ?? ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function NumberInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
                type="number"
                className={inputCls}
                placeholder={field.placeholder ?? ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function DateInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
                type="date"
                className={inputCls}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function TimeInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
                type="time"
                className={inputCls}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function SelectInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <select
                className={inputCls}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">— Select —</option>
                {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function RadioInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="flex flex-col gap-2 mt-1">
                {(field.options ?? []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name={field.id}
                            value={opt}
                            checked={value === opt}
                            onChange={() => onChange(opt)}
                            className="accent-[#043F2E] w-4 h-4"
                        />
                        <span className="text-sm text-gray-800">{opt}</span>
                    </label>
                ))}
            </div>
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

export function YesNoInput({ field, value, onChange, error }: BaseProps) {
    return (
        <div>
            <label className={labelCls}>
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="flex gap-3 mt-1">
                {(['Yes', 'No'] as const).map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                            value === opt
                                ? opt === 'Yes'
                                    ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
            {error && <p className={errorCls}>{error}</p>}
        </div>
    );
}

/** Renders the correct input component for any FormField */
export function FieldInput({ field, value, onChange, error }: BaseProps) {
    switch (field.type) {
        case 'textarea':
            return <TextareaInput field={field} value={value} onChange={onChange} error={error} />;
        case 'number':
            return <NumberInput field={field} value={value} onChange={onChange} error={error} />;
        case 'date':
            return <DateInput field={field} value={value} onChange={onChange} error={error} />;
        case 'time':
            return <TimeInput field={field} value={value} onChange={onChange} error={error} />;
        case 'select':
            return <SelectInput field={field} value={value} onChange={onChange} error={error} />;
        case 'radio':
            return <RadioInput field={field} value={value} onChange={onChange} error={error} />;
        case 'yes_no':
            return <YesNoInput field={field} value={value} onChange={onChange} error={error} />;
        default:
            return <TextInput field={field} value={value} onChange={onChange} error={error} />;
    }
}
