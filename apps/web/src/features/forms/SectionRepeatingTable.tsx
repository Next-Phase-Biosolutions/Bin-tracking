import { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { RepeatingColumn } from '@bin-tracker/types';

const STICKY_LEFT = ['left-0', 'left-[7.25rem]', 'left-[14.5rem]'] as const;

function stickyCellClass(colIdx: number, stickyCount: number, header: boolean): string {
    if (colIdx >= stickyCount) return '';
    const bg = header ? 'bg-[#043F2E]' : 'bg-white';
    const shadow = colIdx === stickyCount - 1 ? ' shadow-[4px_0_6px_-2px_rgba(0,0,0,0.12)]' : '';
    return `sticky z-10 ${STICKY_LEFT[colIdx] ?? 'left-0'} ${bg}${shadow}`;
}

export type TableRow = Record<string, string>;

export function emptyTableRow(columns: RepeatingColumn[]): TableRow {
    const row: TableRow = {};
    for (const col of columns) {
        row[col.id] = col.type === 'date' ? new Date().toISOString().split('T')[0]! : '';
    }
    return row;
}

interface Props {
    columns: RepeatingColumn[];
    rows: TableRow[];
    onRowsChange: (rows: TableRow[]) => void;
    errors: Record<string, string>;
    rowKeyPrefix: string;
    /** Pin first N columns while scrolling wide tables */
    stickyColumnCount?: number;
    /** Cell keys (`${rowKeyPrefix}_${rowIdx}_${colId}`) the voice fill was unsure about. */
    flaggedKeys?: Set<string>;
}

export function SectionRepeatingTable({
    columns,
    rows,
    onRowsChange,
    errors,
    rowKeyPrefix,
    stickyColumnCount = 0,
    flaggedKeys,
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickyCount = Math.min(stickyColumnCount, STICKY_LEFT.length, columns.length);

    useEffect(() => {
        scrollRef.current?.scrollTo({ left: 0 });
    }, [columns.length, rowKeyPrefix]);
    const setCellValue = (rowIdx: number, colId: string, value: string) => {
        const next = [...rows];
        next[rowIdx] = { ...next[rowIdx]!, [colId]: value };
        onRowsChange(next);
    };

    const cellBorder = 'border border-gray-400';
    const inputCls = (hasError: boolean) =>
        `w-full min-w-[3.5rem] border-0 bg-transparent px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#043F2E] focus:ring-inset ${
            hasError ? 'bg-red-50 ring-1 ring-red-400' : ''
        }`;

    return (
        <div className="overflow-hidden rounded-lg border border-gray-400 bg-white shadow-sm">
            {columns.length >= 6 && (
                <p className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] text-gray-600">
                    Scroll right to see all columns. Date, Species, and Number of animals stay pinned on
                    the left.
                </p>
            )}
            <div ref={scrollRef} className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse border border-gray-400 text-xs">
                    <thead>
                        <tr className="bg-[#043F2E]">
                            {columns.map((col, colIdx) => (
                                <th
                                    key={col.id}
                                    className={`${cellBorder} whitespace-nowrap px-3 py-2.5 text-left font-semibold text-white ${stickyCellClass(colIdx, stickyCount, true)}`}
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
                                {columns.map((col, colIdx) => {
                                    const errKey = `${rowKeyPrefix}_${rowIdx}_${col.id}`;
                                    const hasError = !!errors[errKey];
                                    const flagged = flaggedKeys?.has(errKey) ?? false;
                                    return (
                                        <td
                                            key={col.id}
                                            className={`${cellBorder} min-w-[4rem] p-0 align-top ${stickyCellClass(colIdx, stickyCount, false)} ${flagged ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''}`}
                                        >
                                            {col.type === 'yes_no' ? (
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
                                            ) : col.type === 'select' ? (
                                                <select
                                                    className={inputCls(hasError)}
                                                    value={row[col.id] ?? ''}
                                                    onChange={(e) =>
                                                        setCellValue(rowIdx, col.id, e.target.value)
                                                    }
                                                >
                                                    <option value="">—</option>
                                                    {(col.options ?? []).map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : col.type === 'textarea' ? (
                                                <textarea
                                                    rows={2}
                                                    className={`${inputCls(hasError)} resize-none`}
                                                    value={row[col.id] ?? ''}
                                                    onChange={(e) =>
                                                        setCellValue(rowIdx, col.id, e.target.value)
                                                    }
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
                                                    onChange={(e) =>
                                                        setCellValue(rowIdx, col.id, e.target.value)
                                                    }
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                                <td className={`${cellBorder} px-1 py-1 align-middle`}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRowsChange(
                                                rows.length === 1
                                                    ? rows
                                                    : rows.filter((_, i) => i !== rowIdx),
                                            )
                                        }
                                        disabled={rows.length === 1}
                                        className="p-1.5 text-gray-400 transition-colors hover:text-red-500 disabled:opacity-30"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-3">
                <button
                    type="button"
                    onClick={() => onRowsChange([...rows, emptyTableRow(columns)])}
                    className="flex items-center gap-2 text-sm font-semibold text-[#043F2E] hover:text-[#032f22]"
                >
                    <Plus className="h-4 w-4" />
                    Add row
                </button>
            </div>
            <p className="pb-2 text-center text-xs text-gray-400">
                {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </p>
        </div>
    );
}

export function validateTableRows(
    columns: RepeatingColumn[],
    rows: TableRow[],
    rowKeyPrefix: string,
): Record<string, string> {
    const errs: Record<string, string> = {};
    rows.forEach((row, rowIdx) => {
        for (const col of columns) {
            if (col.required && !row[col.id]?.trim()) {
                errs[`${rowKeyPrefix}_${rowIdx}_${col.id}`] = 'Required';
            }
        }
    });
    return errs;
}
