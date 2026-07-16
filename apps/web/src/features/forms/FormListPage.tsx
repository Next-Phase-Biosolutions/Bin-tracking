import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, CheckSquare, Grid3x3, TableProperties, AlertCircle, Loader2, PlusCircle, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createStationTRPCClient, STATION_TOKEN } from '../../lib/trpc';
import type { FormTemplate, FormTypeValue } from '@bin-tracker/types';
import { FormRenderer } from './FormRenderer';
import { FormBuilder } from './FormBuilder';

// form.listByStage requires stationProcedure — scoped to this one call.
const stationClient = createStationTRPCClient(STATION_TOKEN);

const STAGE = import.meta.env.VITE_STATION_STAGE || 'ALL';

const typeConfig: Record<FormTypeValue, { label: string; Icon: React.ElementType; color: string }> = {
    standard: { label: 'Multi-Section', Icon: ClipboardList, color: 'bg-blue-100 text-blue-700' },
    checklist: { label: 'Checklist', Icon: CheckSquare, color: 'bg-green-100 text-green-700' },
    matrix: { label: 'Matrix / Grid', Icon: Grid3x3, color: 'bg-purple-100 text-purple-700' },
    repeating: { label: 'Repeating Table', Icon: TableProperties, color: 'bg-orange-100 text-orange-700' },
};

function FormCard({ form, onOpen }: { form: FormTemplate; onOpen: () => void }) {
    const cfg = typeConfig[form.formType] ?? typeConfig.standard;
    const { Icon } = cfg;
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{form.title}</h3>
                    {form.description && (
                        <p className="text-sm text-gray-500 mt-0.5 leading-snug">{form.description}</p>
                    )}
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                </span>
            </div>
            <button
                type="button"
                onClick={onOpen}
                className="w-full bg-[#043F2E] hover:bg-[#032f22] text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
                Fill Form
            </button>
        </div>
    );
}

export function FormListPage() {
    const [openForm, setOpenForm] = useState<FormTemplate | null>(null);
    const [showBuilder, setShowBuilder] = useState(false);

    const { data: forms, isLoading, error } = useQuery({
        queryKey: ['form.listByStage', STAGE],
        queryFn: () => stationClient.form.listByStage.query({ stage: STAGE }),
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    if (showBuilder) {
        return <FormBuilder onBack={() => setShowBuilder(false)} />;
    }

    if (openForm) {
        return <FormRenderer form={openForm} onBack={() => setOpenForm(null)} />;
    }

    return (
        <div className="min-h-screen bg-[#F5F8F2]">
            {/* Header */}
            <div className="bg-[#043F2E] px-4 pt-10 pb-6">
                <Link
                    to="/app/bin"
                    className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Scanner
                </Link>
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Forms</h1>
                        <p className="text-white/60 text-sm mt-1">Select a form to fill out</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Link
                            to="/app/forms/import"
                            className="flex items-center gap-2 bg-white text-[#043F2E] text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-gray-100"
                        >
                            <Camera className="w-4 h-4" />
                            From Photo
                        </Link>
                        <button
                            type="button"
                            onClick={() => setShowBuilder(true)}
                            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Manual Builder
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 py-6 max-w-xl mx-auto">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-3" />
                        <p className="text-sm">Loading forms...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-800 text-sm">Could not load forms</p>
                            <p className="text-red-600 text-xs mt-1">{error.message}</p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && forms?.length === 0 && (
                    <div className="text-center py-20 text-gray-400">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No forms available</p>
                        <p className="text-sm mt-1">No active forms for this station's stage.</p>
                    </div>
                )}

                {forms && forms.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {(forms as FormTemplate[]).map((form) => (
                            <FormCard
                                key={form.id}
                                form={form}
                                onOpen={() => setOpenForm(form)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FormListPage;
