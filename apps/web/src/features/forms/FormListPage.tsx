import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createStationTRPCClient, STATION_TOKEN } from '../../lib/trpc';
import type { FormTemplate, FormTypeValue } from '@bin-tracker/types';
import { FormRenderer } from './FormRenderer';
import { FormBuilder } from './FormBuilder';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/primitives';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';

// form.listByStage requires stationProcedure — scoped to this one call.
const stationClient = createStationTRPCClient(STATION_TOKEN);

const STAGE = import.meta.env.VITE_STATION_STAGE || 'ALL';

const typeConfig: Record<FormTypeValue, { label: string; icon: string; tone: 'active' | 'good' | 'pending' | 'warn' }> = {
    standard: { label: 'Multi-Section', icon: 'form', tone: 'active' },
    checklist: { label: 'Checklist', icon: 'check', tone: 'good' },
    matrix: { label: 'Matrix / Grid', icon: 'grid', tone: 'pending' },
    repeating: { label: 'Repeating Table', icon: 'form', tone: 'warn' },
};

function FormCard({ form, onOpen }: { form: FormTemplate; onOpen: () => void }) {
    const cfg = typeConfig[form.formType] ?? typeConfig.standard;
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-edge/70 bg-white p-5 shadow-card transition-shadow hover:shadow-panel-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <h3 className="font-display text-base font-bold leading-snug text-olive-deep">{form.title}</h3>
                    {form.description && <p className="mt-0.5 text-sm leading-snug text-muted">{form.description}</p>}
                </div>
                <Badge tone={cfg.tone} className="whitespace-nowrap">
                    <Icon name={cfg.icon} width={12} height={12} />
                    {cfg.label}
                </Badge>
            </div>
            <button
                type="button"
                onClick={onOpen}
                className="w-full rounded-xl bg-olive-deep py-2.5 text-sm font-bold text-bone-light transition-colors hover:bg-olive-deep/90"
            >
                Fill Form
            </button>
        </div>
    );
}

export function FormListPage() {
    const [openForm, setOpenForm] = useState<FormTemplate | null>(null);
    const [showBuilder, setShowBuilder] = useState(false);
    // Direct-URL guard: the sidebar already hides this link for orgs without
    // FORMS, but the page itself must refuse too (same pattern as GuardScannerPage).
    const { hasModule, isLoading: modulesLoading } = useSubscription();

    const { data: forms, isLoading, error } = useQuery({
        queryKey: ['form.listByStage', STAGE],
        queryFn: () => stationClient.form.listByStage.query({ stage: STAGE }),
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    if (modulesLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <FacilityLoader variant="inline" label="forms" />
            </div>
        );
    }
    if (!hasModule('FORMS')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
                <UpgradePrompt module="FORMS" />
            </div>
        );
    }

    if (showBuilder) {
        return <FormBuilder onBack={() => setShowBuilder(false)} />;
    }

    if (openForm) {
        return <FormRenderer form={openForm} onBack={() => setOpenForm(null)} />;
    }

    return (
        <div className="min-h-screen bg-canvas">
            {/* Header */}
            <div className="relative overflow-hidden bg-olive-deep px-4 pb-6 pt-10">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
                <Link to="/app/bin" className="relative mb-4 flex items-center gap-2 text-sm text-bone/70 transition-colors hover:text-bone">
                    <Icon name="arrow" width={15} height={15} className="rotate-180" />
                    Back to Scanner
                </Link>
                <div className="relative flex items-end justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-extrabold text-bone">Forms</h1>
                        <p className="mt-1 text-sm text-bone/60">Select a form to fill out</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                            to="/app/forms/import"
                            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-olive-deep transition-colors hover:bg-bone-light"
                        >
                            <Icon name="camera" width={15} height={15} />
                            From Photo
                        </Link>
                        <button
                            type="button"
                            onClick={() => setShowBuilder(true)}
                            className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-bone transition-colors hover:bg-white/25"
                        >
                            <Icon name="form" width={15} height={15} />
                            Manual Builder
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-xl px-4 py-6">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <FacilityLoader variant="inline" label="forms" />
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-3 rounded-2xl border border-rust/30 bg-rust/10 p-5">
                        <Icon name="thermo" width={20} height={20} className="mt-0.5 shrink-0 text-rust" />
                        <div>
                            <p className="text-sm font-semibold text-rust">Could not load forms</p>
                            <p className="mt-1 text-xs text-rust">{error.message}</p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && forms?.length === 0 && (
                    <div className="py-20 text-center text-muted">
                        <Icon name="form" width={48} height={48} className="mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No forms available</p>
                        <p className="mt-1 text-sm">No active forms for this station&apos;s stage.</p>
                    </div>
                )}

                {forms && forms.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {(forms as FormTemplate[]).map((form) => (
                            <FormCard key={form.id} form={form} onOpen={() => setOpenForm(form)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FormListPage;
