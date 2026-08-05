import { useState } from 'react';
import { voiceKeys, type ChecklistSchema, type FormVoiceFillResult } from '@bin-tracker/types';
import { FieldInput } from '../FieldComponents';
import { VoiceFormFillButton } from '../VoiceFormFillButton';
import { VoiceBlanketBanner, VoiceBlanketMark } from '../VoiceBlanketNotice';

interface Props {
    schema: ChecklistSchema;
    onSubmit: () => void;
    /** Form id — enables the whole-form voice fill button. Omit in preview. */
    formId?: string;
}

interface ItemState {
    answer: 'yes' | 'no' | null;
    deviation: string;
    corrective: string;
}

const EMPTY_ITEM: ItemState = { answer: null, deviation: '', corrective: '' };

/** DOM id for a checklist item row — the banner's jump target. */
const itemAnchorId = (itemId: string) => `checklist-item-${itemId}`;

export function ChecklistFormRenderer({ schema, onSubmit, formId }: Props) {
    const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
    const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
    const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
    // Header fields the voice fill was unsure about — amber "check this".
    const [flaggedHeaders, setFlaggedHeaders] = useState<Set<string>>(new Set());
    // Item answers a spoken blanket filled rather than the worker naming them.
    const [blanketItems, setBlanketItems] = useState<Set<string>>(new Set());
    // Item answers the voice fill was unsure about — amber, same as fields.
    const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());

    const setHeaderValue = (id: string, value: string) => {
        setHeaderValues((prev) => ({ ...prev, [id]: value }));
        if (headerErrors[id]) {
            setHeaderErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
        }
        if (flaggedHeaders.has(id)) {
            setFlaggedHeaders((prev) => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    const setItemAnswer = (itemId: string, answer: 'yes' | 'no') => {
        setItemStates((prev) => ({
            ...prev,
            [itemId]: { ...(prev[itemId] ?? EMPTY_ITEM), answer },
        }));
        // Touching the answer is the review — drop both markers.
        if (blanketItems.has(itemId)) {
            setBlanketItems((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
        if (flaggedItems.has(itemId)) {
            setFlaggedItems((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
    };

    /**
     * Whole-form voice fill. Header fields come back under their own ids; item
     * answers and their deviation/corrective text ride under composite
     * `voiceKeys`. The service has already forced any item with spoken text to
     * "No", so a described deviation always lands in a visible branch.
     */
    const applyVoiceFill = (result: FormVoiceFillResult) => {
        const nextHeaders: Record<string, string> = {};
        const nextFlagged = new Set<string>();
        for (const field of schema.headerFields) {
            const filled = result.fields[field.id];
            if (!filled) continue;
            nextHeaders[field.id] = filled.value;
            if (filled.confidence === 'low') nextFlagged.add(field.id);
        }
        setHeaderValues((prev) => ({ ...prev, ...nextHeaders }));
        setFlaggedHeaders((prev) => new Set([...prev, ...nextFlagged]));

        const nextItems: Record<string, ItemState> = { ...itemStates };
        const nextBlanket = new Set<string>();
        const nextFlaggedItems = new Set<string>();
        for (const group of schema.groups) {
            for (const item of group.items) {
                const answer = result.fields[voiceKeys.checklistAnswer(item.id)];
                const deviation = result.fields[voiceKeys.checklistDeviation(item.id)];
                const corrective = result.fields[voiceKeys.checklistCorrective(item.id)];
                if (!answer && !deviation && !corrective) continue;

                const current = nextItems[item.id] ?? EMPTY_ITEM;
                nextItems[item.id] = {
                    // The service only ever emits an exact 'Yes' or 'No' here —
                    // it drops anything else rather than let this branch coerce it.
                    answer: answer ? (answer.value === 'Yes' ? 'yes' : 'no') : current.answer,
                    deviation: deviation?.value ?? current.deviation,
                    corrective: corrective?.value ?? current.corrective,
                };
                if (answer?.source === 'blanket') nextBlanket.add(item.id);
                else if (answer?.confidence === 'low') nextFlaggedItems.add(item.id);
            }
        }
        setItemStates(nextItems);
        setBlanketItems((prev) => new Set([...prev, ...nextBlanket]));
        setFlaggedItems((prev) => new Set([...prev, ...nextFlaggedItems]));
    };

    const setItemText = (itemId: string, key: 'deviation' | 'corrective', value: string) => {
        setItemStates((prev) => ({
            ...prev,
            [itemId]: { ...(prev[itemId] ?? EMPTY_ITEM), [key]: value },
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

    const firstBlanketId =
        schema.groups
            .flatMap((g) => g.items)
            .find((item) => blanketItems.has(item.id))?.id ?? null;

    return (
        <div className="flex flex-col gap-5">
            {formId && (
                <VoiceFormFillButton
                    formId={formId}
                    onFill={applyVoiceFill}
                    hint="Speak once — the header details, then any items that failed. Say “everything else is compliant” to cover the rest."
                />
            )}
            <VoiceBlanketBanner
                count={blanketItems.size}
                firstId={firstBlanketId ? itemAnchorId(firstBlanketId) : null}
            />

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
                                    flagged={flaggedHeaders.has(f.id)}
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
                            const state = itemStates[item.id] ?? EMPTY_ITEM;
                            const fromBlanket = blanketItems.has(item.id);
                            const unsure = flaggedItems.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    id={itemAnchorId(item.id)}
                                    className={`p-4 ${fromBlanket ? 'bg-bone-light/60' : ''}`}
                                >
                                    <p className="text-sm text-ink mb-3 leading-snug">{item.label}</p>
                                    <div
                                        className={`flex items-center gap-2 mb-2 rounded-lg ${
                                            unsure ? 'ring-2 ring-warn border-warn p-2' : ''
                                        }`}
                                    >
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
                                        {fromBlanket && <VoiceBlanketMark />}
                                    </div>
                                    {unsure && (
                                        <p className="text-warn text-xs mb-2">
                                            Check this — voice fill wasn&apos;t sure
                                        </p>
                                    )}
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
