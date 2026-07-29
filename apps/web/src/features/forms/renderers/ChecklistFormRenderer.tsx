import { useState } from 'react';
import type { ChecklistSchema } from '@bin-tracker/types';
import { FieldInput } from '../FieldComponents';

interface Props {
    schema: ChecklistSchema;
    onSubmit: () => void;
}

interface ItemState {
    answer: 'yes' | 'no' | null;
    deviation: string;
    corrective: string;
}

export function ChecklistFormRenderer({ schema, onSubmit }: Props) {
    const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
    const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
    const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});

    const setHeaderValue = (id: string, value: string) => {
        setHeaderValues((prev) => ({ ...prev, [id]: value }));
        if (headerErrors[id]) {
            setHeaderErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
        }
    };

    const setItemAnswer = (itemId: string, answer: 'yes' | 'no') => {
        setItemStates((prev) => ({
            ...prev,
            [itemId]: { ...(prev[itemId] ?? { deviation: '', corrective: '' }), answer },
        }));
    };

    const setItemText = (itemId: string, key: 'deviation' | 'corrective', value: string) => {
        setItemStates((prev) => ({
            ...prev,
            [itemId]: { ...(prev[itemId] ?? { answer: null, deviation: '', corrective: '' }), [key]: value },
        }));
    };

    const handleSubmit = () => {
        const errs: Record<string, string> = {};
        for (const f of schema.headerFields) {
            if (f.required && !headerValues[f.id]?.trim()) errs[f.id] = 'Required';
        }
        if (Object.keys(errs).length > 0) {
            setHeaderErrors(errs);
            return;
        }
        onSubmit();
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Header fields */}
            {schema.headerFields.length > 0 && (
                <div className="bg-white rounded-2xl border border-edge p-5 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                        {schema.headerFields.map((f) => (
                            <div key={f.id} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                                <FieldInput
                                    field={f}
                                    value={headerValues[f.id] ?? ''}
                                    onChange={(v) => setHeaderValue(f.id, v)}
                                    error={headerErrors[f.id]}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Checklist groups */}
            {schema.groups.map((group) => (
                <div key={group.id} className="bg-white rounded-2xl border border-edge shadow-sm overflow-hidden">
                    <div className="bg-olive-deep px-5 py-3">
                        <h3 className="text-sm font-bold text-bone-light">{group.title}</h3>
                    </div>
                    <div className="divide-y divide-edge/50">
                        {group.items.map((item) => {
                            const state = itemStates[item.id] ?? { answer: null, deviation: '', corrective: '' };
                            return (
                                <div key={item.id} className="p-4">
                                    <p className="text-sm text-ink mb-3 leading-snug">{item.label}</p>
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setItemAnswer(item.id, 'yes')}
                                            className={`px-5 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                                state.answer === 'yes'
                                                    ? 'bg-live text-white border-live'
                                                    : 'bg-white text-ink border-edge hover:border-live'
                                            }`}
                                        >
                                            Yes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setItemAnswer(item.id, 'no')}
                                            className={`px-5 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                                state.answer === 'no'
                                                    ? 'bg-rust text-canvas border-rust'
                                                    : 'bg-white text-ink border-edge hover:border-rust'
                                            }`}
                                        >
                                            No
                                        </button>
                                    </div>
                                    {state.answer === 'no' && (
                                        <div className="flex flex-col gap-2 mt-2 pl-1">
                                            <div>
                                                <label className="block text-xs font-semibold text-muted mb-1">
                                                    Description of Deviation
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full border border-edge rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rust resize-none"
                                                    value={state.deviation}
                                                    onChange={(e) => setItemText(item.id, 'deviation', e.target.value)}
                                                    placeholder="Describe the deviation..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-muted mb-1">
                                                    Corrective Actions
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full border border-edge rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-warn resize-none"
                                                    value={state.corrective}
                                                    onChange={(e) => setItemText(item.id, 'corrective', e.target.value)}
                                                    placeholder="Corrective action taken..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={handleSubmit}
                className="w-full bg-olive-deep hover:bg-olive-deep/90 text-bone-light py-4 rounded-xl text-lg font-bold transition-colors mt-2"
            >
                Submit Form
            </button>
        </div>
    );
}
