import { useState } from 'react';
import type { MatrixSchema } from '@bin-tracker/types';
import { FieldInput } from '../FieldComponents';

interface Props {
    schema: MatrixSchema;
    onSubmit: () => void;
}

interface CellState {
    answer: 'YES' | 'NO' | null;
    ingredient: string;
}

export function MatrixFormRenderer({ schema, onSubmit }: Props) {
    const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
    const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
    const [footerValues, setFooterValues] = useState<Record<string, string>>({});
    const [footerErrors, setFooterErrors] = useState<Record<string, string>>({});
    // key: `${rowId}__${colId}`
    const [cells, setCells] = useState<Record<string, CellState>>({});

    const cellKey = (rowId: string, colId: string) => `${rowId}__${colId}`;

    const setCellAnswer = (rowId: string, colId: string, answer: 'YES' | 'NO') => {
        setCells((prev) => ({
            ...prev,
            [cellKey(rowId, colId)]: {
                ...(prev[cellKey(rowId, colId)] ?? { ingredient: '' }),
                answer,
            },
        }));
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
            setHeaderErrors(errs);
            setFooterErrors(
                Object.fromEntries(
                    Object.entries(errs)
                        .filter(([k]) => k.startsWith('footer_'))
                        .map(([k, v]) => [k.replace('footer_', ''), v]),
                ),
            );
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
                                    onChange={(v) => {
                                        setHeaderValues((prev) => ({ ...prev, [f.id]: v }));
                                        if (headerErrors[f.id]) setHeaderErrors((prev) => { const n = { ...prev }; delete n[f.id]; return n; });
                                    }}
                                    error={headerErrors[f.id]}
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
                                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-bone-light/50'}>
                                    <td className="px-4 py-3 text-ink leading-snug text-xs align-top">
                                        {row.label}
                                    </td>
                                    {schema.columns.map((col) => {
                                        const cell = cells[cellKey(row.id, col.id)] ?? { answer: null, ingredient: '' };
                                        return (
                                            <td key={col.id} className="px-3 py-3 align-top text-center">
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
                                }}
                                error={footerErrors[f.id]}
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
