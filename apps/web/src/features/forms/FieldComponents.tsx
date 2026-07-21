import type { FormField } from '@bin-tracker/types';
import { VoiceFieldButton } from './VoiceFieldButton';

interface BaseProps {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    showVoice?: boolean;
    /** AI voice-fill wasn't confident about this value — highlight for review. */
    flagged?: boolean;
}

function FieldLabelRow({ field, showVoice, onChange }: BaseProps) {
    const voice = showVoice && field.voiceEnabled;
    return (
        <div className="flex items-start justify-between gap-2 mb-1">
            <label className="block text-sm font-semibold text-gray-700 flex-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {voice && (
                <VoiceFieldButton
                    fieldId={field.id}
                    fieldLabel={field.label}
                    fieldType={field.type}
                    fieldOptions={field.options}
                    onValue={onChange}
                />
            )}
        </div>
    );
}

const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#043F2E] focus:border-transparent disabled:bg-gray-50';
const errorCls = 'text-red-600 text-xs mt-1';
const flagRing = 'ring-2 ring-amber-400 border-amber-400';

/** Shows the required-field error, or (when clean) the amber voice-fill review hint. */
function FieldHint({ flagged, error }: { flagged?: boolean; error?: string }) {
    if (error) return <p className={errorCls}>{error}</p>;
    if (flagged) return <p className="text-amber-600 text-xs mt-1">Check this — voice fill wasn&apos;t sure</p>;
    return null;
}

function withFlag(base: string, flagged?: boolean): string {
    return flagged ? `${base} ${flagRing}` : base;
}

export function TextInput({ field, value, onChange, error, showVoice, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} showVoice={showVoice} />
            <input
                type="text"
                className={withFlag(inputCls, flagged)}
                placeholder={field.placeholder ?? ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function TextareaInput({ field, value, onChange, error, showVoice, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} showVoice={showVoice} />
            <textarea
                rows={3}
                className={`${withFlag(inputCls, flagged)} resize-none`}
                placeholder={field.placeholder ?? ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function NumberInput({ field, value, onChange, error, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} />
            <input
                type="number"
                className={withFlag(inputCls, flagged)}
                placeholder={field.placeholder ?? ''}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function DateInput({ field, value, onChange, error, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} />
            <input
                type="date"
                className={withFlag(inputCls, flagged)}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function TimeInput({ field, value, onChange, error, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} />
            <input
                type="time"
                className={withFlag(inputCls, flagged)}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function SelectInput({ field, value, onChange, error, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} />
            <select
                className={withFlag(inputCls, flagged)}
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
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function RadioInput({ field, value, onChange, error, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} />
            <div className={`flex flex-col gap-2 mt-1 rounded-lg ${flagged ? `${flagRing} p-2` : ''}`}>
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
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

export function YesNoInput({ field, value, onChange, error, flagged }: BaseProps) {
    return (
        <div>
            <FieldLabelRow field={field} value={value} onChange={onChange} />
            <div className={`flex gap-3 mt-1 rounded-lg ${flagged ? `${flagRing} p-2` : ''}`}>
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
            <FieldHint flagged={flagged} error={error} />
        </div>
    );
}

/** Renders the correct input component for any FormField */
export function FieldInput({ field, value, onChange, error, showVoice = true, flagged }: BaseProps) {
    const voice = showVoice;
    switch (field.type) {
        case 'textarea':
            return (
                <TextareaInput
                    field={field}
                    value={value}
                    onChange={onChange}
                    error={error}
                    showVoice={voice}
                    flagged={flagged}
                />
            );
        case 'number':
            return <NumberInput field={field} value={value} onChange={onChange} error={error} flagged={flagged} />;
        case 'date':
            return <DateInput field={field} value={value} onChange={onChange} error={error} flagged={flagged} />;
        case 'time':
            return <TimeInput field={field} value={value} onChange={onChange} error={error} flagged={flagged} />;
        case 'select':
            return <SelectInput field={field} value={value} onChange={onChange} error={error} flagged={flagged} />;
        case 'radio':
            return <RadioInput field={field} value={value} onChange={onChange} error={error} flagged={flagged} />;
        case 'yes_no':
            return <YesNoInput field={field} value={value} onChange={onChange} error={error} flagged={flagged} />;
        default:
            return (
                <TextInput
                    field={field}
                    value={value}
                    onChange={onChange}
                    error={error}
                    showVoice={voice}
                    flagged={flagged}
                />
            );
    }
}
