import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { RepeatingSchema } from '@bin-tracker/types';

interface Props {
    schema: RepeatingSchema;
    onSubmit: () => void;
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

export function RepeatingRowFormRenderer({ schema, onSubmit, previewMode }: Props) {
    const [rows, setRows] = useState<Row[]>([emptyRow(schema)]);
    const [errors, setErrors] = useState<Record<string, string>>({});

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

    const cellBorder = 'border border-gray-400';
    const inputCls = (hasError: boolean) =>
        `w-full min-w-[3.5rem] border-0 bg-transparent px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#043F2E] focus:ring-inset ${
            hasError ? 'bg-red-50 ring-1 ring-red-400' : ''
        }`;

    return (
        <div className="flex flex-col gap-5">
            {/* Instructions banner */}
            {schema.instructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide">Instructions</p>
                    <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">
                        {schema.instructions}
                    </p>
                </div>
            )}

            {/* Rows table */}
            <div className="overflow-hidden rounded-lg border border-gray-400 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-collapse border border-gray-400 text-xs">
                        <thead>
                            <tr className="bg-[#043F2E]">
                                {schema.columns.map((col) => (
                                    <th
                                        key={col.id}
                                        className={`${cellBorder} whitespace-nowrap px-3 py-2.5 text-left font-semibold text-white`}
                                    >
                                        {col.label}
                                        {col.required && <span className="ml-0.5 text-red-300">*</span>}
                                    </th>
                                ))}
                                <th className={`${cellBorder} w-10 bg-[#043F2E] px-2 py-2.5`} />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="bg-white">
                                    {schema.columns.map((col) => {
                                        const errKey = `${rowIdx}_${col.id}`;
                                        const hasError = !!errors[errKey];
                                        return (
                                            <td key={col.id} className={`${cellBorder} min-w-[4rem] p-0 align-top`}>
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
                                                                            ? 'bg-green-600 text-white'
                                                                            : 'bg-red-600 text-white'
                                                                        : 'border border-gray-300 bg-white'
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
                                            className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={addRow}
                        className="flex items-center gap-2 text-sm font-semibold text-[#043F2E] hover:text-[#032f22] transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Row
                    </button>
                </div>
            </div>

            <p className="text-xs text-gray-400 text-center">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</p>

            {!previewMode && (
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full bg-[#043F2E] hover:bg-[#032f22] text-white py-4 rounded-xl text-lg font-bold transition-colors"
                >
                    Submit Form
                </button>
            )}
        </div>
    );
}
