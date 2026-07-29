import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
    VOICE_FILL_REPEATING_KEY,
    type RepeatingSchema,
    type FormVoiceFillResult,
} from '@bin-tracker/types';
import { VoiceFormFillButton } from '../VoiceFormFillButton';

interface Props {
    schema: RepeatingSchema;
    onSubmit: () => void;
    /** Form id — enables the whole-form voice fill button. Omit in preview. */
    formId?: string;
    previewMode?: boolean;
}

type Row = Record<string, string>;

function emptyRow(schema: RepeatingSchema): Row {
    const row: Row = {};
    for (const col of schema.columns) {
        row[col.id] = col.type === 'date' ? new Date().toISOString().split('T')[0]! : '';
    }
    return row;
}

export function RepeatingRowFormRenderer({ schema, onSubmit, formId, previewMode }: Props) {
    const [rows, setRows] = useState<Row[]>([emptyRow(schema)]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Cells (`${rowIdx}_${colId}`) the voice fill was unsure about.
    const [flaggedCells, setFlaggedCells] = useState<Set<string>>(new Set());

    const setCellValue = (rowIdx: number, colId: string, value: string) => {
        setRows((prev) => {
            const next = [...prev];
            next[rowIdx] = { ...next[rowIdx]!, [colId]: value };
            return next;
        });
        const key = `${rowIdx}_${colId}`;
        if (errors[key]) {
            setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
        }
        if (flaggedCells.has(key)) {
            setFlaggedCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
        }
    };

    // Whole-form voice fill: append one row from the spoken reading, flagging
    // low-confidence cells for review.
    const applyVoiceFill = (result: FormVoiceFillResult) => {
        const cols = result.tableRows[VOICE_FILL_REPEATING_KEY];
        if (!cols) return;
        const row = emptyRow(schema);
        for (const [colId, filled] of Object.entries(cols)) row[colId] = filled.value;

        const rowIdx = rows.length; // the appended row index
        const newFlagged = new Set<string>();
        for (const [colId, filled] of Object.entries(cols)) {
            if (filled.confidence === 'low') newFlagged.add(`${rowIdx}_${colId}`);
        }
        setRows((prev) => [...prev, row]);
        setFlaggedCells((prev) => new Set([...prev, ...newFlagged]));
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow(schema)]);

    const removeRow = (idx: number) => {
        if (rows.length === 1) return;
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        const errs: Record<string, string> = {};
        rows.forEach((row, rowIdx) => {
            for (const col of schema.columns) {
                if (col.required && !row[col.id]?.trim()) {
                    errs[`${rowIdx}_${col.id}`] = 'Required';
                }
            }
        });
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        onSubmit();
    };

    const cellBorder = 'border border-edge';
    const inputCls = (hasError: boolean) =>
        `w-full min-w-[3.5rem] border-0 bg-transparent px-2 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rust focus:ring-inset ${
            hasError ? 'bg-rust/10 ring-1 ring-rust/40' : ''
        }`;

    return (
        <div className="flex flex-col gap-5">
            {formId && !previewMode && (
                <VoiceFormFillButton formId={formId} onFill={applyVoiceFill} />
            )}
            {/* Instructions banner */}
            {schema.instructions && (
                <div className="bg-bone-light border border-edge rounded-2xl p-4">
                    <p className="text-xs font-bold text-olive-deep mb-2 uppercase tracking-wide">Instructions</p>
                    <p className="text-sm text-ink whitespace-pre-line leading-relaxed">
                        {schema.instructions}
                    </p>
                </div>
            )}

            {/* Rows table */}
            <div className="overflow-hidden rounded-lg border border-edge bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-collapse border border-edge text-xs">
                        <thead>
                            <tr className="bg-olive-deep">
                                {schema.columns.map((col) => (
                                    <th
                                        key={col.id}
                                        className={`${cellBorder} whitespace-nowrap px-3 py-2.5 text-left font-semibold text-bone-light`}
                                    >
                                        {col.label}
                                        {col.required && <span className="ml-0.5 text-rust-light">*</span>}
                                    </th>
                                ))}
                                <th className={`${cellBorder} w-10 bg-olive-deep px-2 py-2.5`} />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="bg-white">
                                    {schema.columns.map((col) => {
                                        const errKey = `${rowIdx}_${col.id}`;
                                        const hasError = !!errors[errKey];
                                        const flagged = flaggedCells.has(errKey);
                                        return (
                                            <td key={col.id} className={`${cellBorder} min-w-[4rem] p-0 align-top ${flagged ? 'bg-warn/10 ring-2 ring-inset ring-warn' : ''}`}>
                                                {col.type === 'select' ? (
                                                    <select
                                                        className={inputCls(hasError)}
                                                        value={row[col.id] ?? ''}
                                                        onChange={(e) => setCellValue(rowIdx, col.id, e.target.value)}
                                                    >
                                                        <option value="">—</option>
                                                        {(col.options ?? []).map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : col.type === 'yes_no' ? (
                                                    <div className="flex gap-1">
                                                        {(['Yes', 'No'] as const).map((opt) => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => setCellValue(rowIdx, col.id, opt)}
                                                                className={`rounded px-2 py-1 text-[10px] font-semibold ${
                                                                    row[col.id] === opt
                                                                        ? opt === 'Yes'
                                                                            ? 'bg-live text-white'
                                                                            : 'bg-rust text-canvas'
                                                                        : 'border border-edge bg-white'
                                                                }`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : col.type === 'textarea' ? (
                                                    <textarea
                                                        rows={2}
                                                        className={`${inputCls(hasError)} resize-none`}
                                                        value={row[col.id] ?? ''}
                                                        onChange={(e) => setCellValue(rowIdx, col.id, e.target.value)}
                                                    />
                                                ) : (
                                                    <input
                                                        type={
                                                            col.type === 'number'
                                                                ? 'number'
                                                                : col.type === 'date'
                                                                ? 'date'
                                                                : col.type === 'time'
                                                                ? 'time'
                                                                : 'text'
                                                        }
                                                        className={inputCls(hasError)}
                                                        value={row[col.id] ?? ''}
                                                        onChange={(e) => setCellValue(rowIdx, col.id, e.target.value)}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className={`${cellBorder} px-1 py-1 align-middle`}>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(rowIdx)}
                                            disabled={rows.length === 1}
                                            className="p-1.5 text-muted hover:text-rust disabled:opacity-30 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 border-t border-edge/50">
                    <button
                        type="button"
                        onClick={addRow}
                        className="flex items-center gap-2 text-sm font-semibold text-olive-deep hover:text-rust transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Row
                    </button>
                </div>
            </div>

            <p className="text-xs text-muted text-center">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</p>

            {!previewMode && (
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full bg-olive-deep hover:bg-olive-deep/90 text-bone-light py-4 rounded-xl text-lg font-bold transition-colors"
                >
                    Submit Form
                </button>
            )}
        </div>
    );
}
