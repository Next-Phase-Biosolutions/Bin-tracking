import { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { RepeatingColumn } from '@bin-tracker/types';

const STICKY_LEFT = ['left-0', 'left-[7.25rem]', 'left-[14.5rem]'] as const;

function stickyCellClass(colIdx: number, stickyCount: number, header: boolean): string {
    if (colIdx >= stickyCount) return '';
    const bg = header ? 'bg-olive-deep' : 'bg-white';
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

    const cellBorder = 'border border-edge';
    const inputCls = (hasError: boolean) =>
        `w-full min-w-[3.5rem] border-0 bg-transparent px-2 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rust focus:ring-inset ${
            hasError ? 'bg-rust/10 ring-1 ring-rust/40' : ''
        }`;

    return (
        <div className="overflow-hidden rounded-lg border border-edge bg-white shadow-sm">
            {columns.length >= 6 && (
                <p className="border-b border-edge/50 bg-bone-light/50 px-3 py-1.5 text-[10px] text-muted">
                    Scroll right to see all columns. Date, Species, and Number of animals stay pinned on
                    the left.
                </p>
            )}
            <div ref={scrollRef} className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse border border-edge text-xs">
                    <thead>
                        <tr className="bg-olive-deep">
                            {columns.map((col, colIdx) => (
                                <th
                                    key={col.id}
                                    className={`${cellBorder} whitespace-nowrap px-3 py-2.5 text-left font-semibold text-bone-light ${stickyCellClass(colIdx, stickyCount, true)}`}
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
                                {columns.map((col, colIdx) => {
                                    const errKey = `${rowKeyPrefix}_${rowIdx}_${col.id}`;
                                    const hasError = !!errors[errKey];
                                    const flagged = flaggedKeys?.has(errKey) ?? false;
                                    return (
                                        <td
                                            key={col.id}
                                            className={`${cellBorder} min-w-[4rem] p-0 align-top ${stickyCellClass(colIdx, stickyCount, false)} ${flagged ? 'bg-warn/10 ring-2 ring-inset ring-warn' : ''}`}
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
                                                                        ? 'bg-live text-white'
                                                                        : 'bg-rust text-canvas'
                                                                    : 'border border-edge bg-white'
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
                                        className="p-1.5 text-muted transition-colors hover:text-rust disabled:opacity-30"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="border-t border-edge/50 px-4 py-3">
                <button
                    type="button"
                    onClick={() => onRowsChange([...rows, emptyTableRow(columns)])}
                    className="flex items-center gap-2 text-sm font-semibold text-olive-deep hover:text-rust"
                >
                    <Plus className="h-4 w-4" />
                    Add row
                </button>
            </div>
            <p className="pb-2 text-center text-xs text-muted">
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
