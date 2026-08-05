import { useState } from 'react';
import { voiceKeys, type MatrixSchema, type FormVoiceFillResult } from '@bin-tracker/types';
import { FieldInput } from '../FieldComponents';
import { VoiceFormFillButton } from '../VoiceFormFillButton';
import { VoiceBlanketBanner, VoiceBlanketMark } from '../VoiceBlanketNotice';

interface Props {
    schema: MatrixSchema;
    onSubmit: () => void;
    /** Form id — enables the whole-form voice fill button. Omit in preview. */
    formId?: string;
}

interface CellState {
    answer: 'YES' | 'NO' | null;
    ingredient: string;
}

const EMPTY_CELL: CellState = { answer: null, ingredient: '' };

/** Matches the service's composite key, so voice results map 1:1 onto cells. */
const cellKey = voiceKeys.matrixCell;

/** DOM id for a matrix row — the banner's jump target. */
const rowAnchorId = (rowId: string) => `matrix-row-${rowId}`;

export function MatrixFormRenderer({ schema, onSubmit, formId }: Props) {
    const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
    const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
    const [footerValues, setFooterValues] = useState<Record<string, string>>({});
    const [footerErrors, setFooterErrors] = useState<Record<string, string>>({});
    // key: `${rowId}__${colId}`
    const [cells, setCells] = useState<Record<string, CellState>>({});
    // Header/footer fields the voice fill was unsure about — amber "check this".
    const [flaggedFields, setFlaggedFields] = useState<Set<string>>(new Set());
    // Cell keys a spoken blanket filled rather than the worker naming them.
    const [blanketCells, setBlanketCells] = useState<Set<string>>(new Set());
    // Cells the voice fill was unsure about — amber, same as fields.
    const [flaggedCells, setFlaggedCells] = useState<Set<string>>(new Set());

    const clearFlag = (id: string) => {
        if (!flaggedFields.has(id)) return;
        setFlaggedFields((prev) => { const n = new Set(prev); n.delete(id); return n; });
    };

    const setCellAnswer = (rowId: string, colId: string, answer: 'YES' | 'NO') => {
        const key = cellKey(rowId, colId);
        setCells((prev) => ({
            ...prev,
            [key]: { ...(prev[key] ?? EMPTY_CELL), answer },
        }));
        // Touching the cell is the review — drop both markers.
        if (blanketCells.has(key)) {
            setBlanketCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
        }
        if (flaggedCells.has(key)) {
            setFlaggedCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
        }
    };

    /**
     * Whole-form voice fill. Header/footer fields come back under their own ids;
     * cells under the composite `voiceKeys`. The service has already forced any
     * cell with a named ingredient to YES, so the ingredient box is visible.
     */
    const applyVoiceFill = (result: FormVoiceFillResult) => {
        const nextFlagged = new Set<string>();
        const collect = (fields: MatrixSchema['headerFields']) => {
            const values: Record<string, string> = {};
            for (const field of fields) {
                const filled = result.fields[field.id];
                if (!filled) continue;
                values[field.id] = filled.value;
                if (filled.confidence === 'low') nextFlagged.add(field.id);
            }
            return values;
        };
        const header = collect(schema.headerFields);
        const footer = collect(schema.footerFields ?? []);
        setHeaderValues((prev) => ({ ...prev, ...header }));
        setFooterValues((prev) => ({ ...prev, ...footer }));
        setFlaggedFields((prev) => new Set([...prev, ...nextFlagged]));

        const nextCells: Record<string, CellState> = { ...cells };
        const nextBlanket = new Set<string>();
        const nextFlaggedCells = new Set<string>();
        for (const row of schema.rows) {
            for (const col of schema.columns) {
                const answer = result.fields[cellKey(row.id, col.id)];
                const ingredient = result.fields[voiceKeys.matrixIngredient(row.id, col.id)];
                if (!answer && !ingredient) continue;

                const key = cellKey(row.id, col.id);
                const current = nextCells[key] ?? EMPTY_CELL;
                nextCells[key] = {
                    // The service only ever emits an exact 'Yes' or 'No' here —
                    // it drops anything else rather than let this branch coerce
                    // an unclear answer into "allergen not present".
                    answer: answer ? (answer.value === 'Yes' ? 'YES' : 'NO') : current.answer,
                    ingredient: ingredient?.value ?? current.ingredient,
                };
                if (answer?.source === 'blanket') nextBlanket.add(key);
                else if (answer?.confidence === 'low') nextFlaggedCells.add(key);
            }
        }
        setCells(nextCells);
        setBlanketCells((prev) => new Set([...prev, ...nextBlanket]));
        setFlaggedCells((prev) => new Set([...prev, ...nextFlaggedCells]));
    };

    const setCellIngredient = (rowId: string, colId: string, value: string) => {
        setCells((prev) => ({
            ...prev,
            [cellKey(rowId, colId)]: {
                ...(prev[cellKey(rowId, colId)] ?? { answer: null }),
                ingredient: value,
            },
        }));
    };

    const handleSubmit = () => {
        const errs: Record<string, string> = {};
        for (const f of schema.headerFields) {
            if (f.required && !headerValues[f.id]?.trim()) errs[f.id] = 'Required';
        }
        for (const f of schema.footerFields ?? []) {
            if (f.required && !footerValues[f.id]?.trim()) errs[`footer_${f.id}`] = 'Required';
        }
        if (Object.keys(errs).length > 0) {
            const isFooter = ([k]: [string, string]) => k.startsWith('footer_');
            setHeaderErrors(Object.fromEntries(Object.entries(errs).filter((e) => !isFooter(e))));
            setFooterErrors(
                Object.fromEntries(
                    Object.entries(errs)
                        .filter(isFooter)
                        .map(([k, v]) => [k.slice('footer_'.length), v]),
                ),
            );
            return;
        }
        onSubmit();
    };

    const firstBlanketRow =
        schema.rows.find((row) =>
            schema.columns.some((col) => blanketCells.has(cellKey(row.id, col.id))),
        )?.id ?? null;

    return (
        <div className="flex flex-col gap-5">
            {formId && (
                <VoiceFormFillButton
                    formId={formId}
                    onFill={applyVoiceFill}
                    hint="Speak once — the header details, then what's present and where. A phrase like “nothing present in the product” fills that whole column."
                />
            )}
            <VoiceBlanketBanner
                count={blanketCells.size}
                firstId={firstBlanketRow ? rowAnchorId(firstBlanketRow) : null}
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
                                    onChange={(v) => {
                                        setHeaderValues((prev) => ({ ...prev, [f.id]: v }));
                                        if (headerErrors[f.id]) setHeaderErrors((prev) => { const n = { ...prev }; delete n[f.id]; return n; });
                                        clearFlag(f.id);
                                    }}
                                    error={headerErrors[f.id]}
                                    flagged={flaggedFields.has(f.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Matrix table */}
            <div className="bg-white rounded-2xl border border-edge shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-olive-deep">
                                <th className="text-left text-bone-light px-4 py-3 font-semibold w-1/3">Component</th>
                                {schema.columns.map((col) => (
                                    <th key={col.id} className="text-center text-bone-light px-3 py-3 font-semibold text-xs leading-tight">
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/50">
                            {schema.rows.map((row, idx) => (
                                <tr
                                    key={row.id}
                                    id={rowAnchorId(row.id)}
                                    className={idx % 2 === 0 ? 'bg-white' : 'bg-bone-light/50'}
                                >
                                    <td className="px-4 py-3 text-ink leading-snug text-xs align-top">
                                        {row.label}
                                    </td>
                                    {schema.columns.map((col) => {
                                        const key = cellKey(row.id, col.id);
                                        const cell = cells[key] ?? EMPTY_CELL;
                                        const fromBlanket = blanketCells.has(key);
                                        const unsure = flaggedCells.has(key);
                                        return (
                                            <td
                                                key={col.id}
                                                className={`px-3 py-3 align-top text-center ${
                                                    unsure ? 'bg-warn/10 ring-2 ring-inset ring-warn' : ''
                                                }`}
                                                title={unsure ? "Check this — voice fill wasn't sure" : undefined}
                                            >
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className="flex gap-1">
                                                        {(['YES', 'NO'] as const).map((ans) => (
                                                            <button
                                                                key={ans}
                                                                type="button"
                                                                onClick={() => setCellAnswer(row.id, col.id, ans)}
                                                                className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                                                                    cell.answer === ans
                                                                        ? ans === 'YES'
                                                                            ? 'bg-live text-white border-live'
                                                                            : 'bg-rust text-canvas border-rust'
                                                                        : 'bg-white text-muted border-edge'
                                                                }`}
                                                            >
                                                                {ans}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {fromBlanket && <VoiceBlanketMark />}
                                                    {cell.answer === 'YES' && (
                                                        <input
                                                            type="text"
                                                            placeholder="Ingredient"
                                                            value={cell.ingredient}
                                                            onChange={(e) => setCellIngredient(row.id, col.id, e.target.value)}
                                                            className="w-24 border border-edge rounded px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-rust"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer fields */}
            {(schema.footerFields ?? []).length > 0 && (
                <div className="bg-white rounded-2xl border border-edge p-5 shadow-sm">
                    <div className="flex flex-col gap-4">
                        {(schema.footerFields ?? []).map((f) => (
                            <FieldInput
                                key={f.id}
                                field={f}
                                value={footerValues[f.id] ?? ''}
                                onChange={(v) => {
                                    setFooterValues((prev) => ({ ...prev, [f.id]: v }));
                                    if (footerErrors[f.id]) setFooterErrors((prev) => { const n = { ...prev }; delete n[f.id]; return n; });
                                    clearFlag(f.id);
                                }}
                                error={footerErrors[f.id]}
                                flagged={flaggedFields.has(f.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

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
