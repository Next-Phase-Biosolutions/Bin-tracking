import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FormDigitizeDraft, FormFillFrequencyValue, FormTriggerTypeValue } from '@bin-tracker/types';
import { trpc } from '../../../lib/trpc';
import { fileToBase64, cropImageRegion, type AcceptedImageMime } from './image-utils';
import { FormDraftLivePreview } from './FormDraftLivePreview';
import { useSubscription } from '../../../context/SubscriptionContext';
import { UpgradePrompt } from '../../../components/UpgradePrompt';
import { Icon } from '../../../components/ui/Icon';
import { FacilityLoader } from '../../../components/app/FacilityLoader';

const STAGES = ['RECEIVING', 'KILL_FLOOR', 'WET_AGING', 'VALUE_ADD', 'SHIPPING'] as const;

const TRIGGER_OPTIONS: { value: FormTriggerTypeValue; label: string }[] = [
    { value: 'on_arrival', label: 'On animal arrival' },
    { value: 'on_cycle_start', label: 'When bin cycle starts' },
    { value: 'scheduled', label: 'Scheduled (time-based)' },
    { value: 'manual', label: 'Manual — worker opens when needed' },
    { value: 'inspection', label: 'Inspection / audit' },
    { value: 'other', label: 'Other' },
];

const FREQUENCY_OPTIONS: { value: FormFillFrequencyValue; label: string }[] = [
    { value: 'per_animal', label: 'Per animal' },
    { value: 'per_shift', label: 'Per shift' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'as_needed', label: 'As needed' },
];

type Step = 'capture' | 'digitize' | 'verify' | 'workflow' | 'done';

function DraftWarningsBanner({ warnings }: { warnings: string[] }) {
    if (warnings.length === 0) return null;
    return (
        <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-ink">
            <p className="mb-1 font-semibold text-warn">Structure adjusted to match the paper table layout</p>
            <ul className="list-disc space-y-0.5 pl-4">
                {warnings.map((w) => (
                    <li key={w}>{w}</li>
                ))}
            </ul>
        </div>
    );
}

export default function FormImportPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    const [step, setStep] = useState<Step>('capture');
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<AcceptedImageMime>('image/jpeg');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [draft, setDraft] = useState<FormDigitizeDraft | null>(null);
    const [refineNote, setRefineNote] = useState('');
    const [selectingRegion, setSelectingRegion] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [region, setRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(
        null,
    );

    const [stage, setStage] = useState<string>('RECEIVING');
    const [triggerType, setTriggerType] = useState<FormTriggerTypeValue>('manual');
    const [fillFrequency, setFillFrequency] = useState<FormFillFrequencyValue>('as_needed');
    const [digitizeJobId, setDigitizeJobId] = useState<string | null>(null);

    // digitizeFromPhoto enqueues a job (Gemini's vision call runs 15-30s) and
    // returns a jobId; digitizeJobStatus polls it every 1.5s while the job is
    // waiting/active, and stops (refetchInterval returns false) once it
    // completes or fails. The effect below advances the wizard step once a
    // result lands, mirroring the old onSuccess handler.
    const digitize = trpc.form.digitizeFromPhoto.useMutation({
        onSuccess: (data) => {
            setDigitizeJobId(data.jobId);
        },
    });

    const digitizeStatus = trpc.form.digitizeJobStatus.useQuery(
        { jobId: digitizeJobId ?? '' },
        {
            enabled: digitizeJobId !== null,
            refetchInterval: (query) => {
                const state = query.state.data?.state;
                return state === 'completed' || state === 'failed' ? false : 1500;
            },
        },
    );

    useEffect(() => {
        const data = digitizeStatus.data;
        if (!data || data.state !== 'completed') return;
        setDraft(data.result);
        setStep('verify');
        setDigitizeJobId(null);
    }, [digitizeStatus.data]);

    const digitizeErrorMessage =
        digitize.error?.message ??
        digitizeStatus.error?.message ??
        (digitizeStatus.data?.state === 'failed'
            ? digitizeStatus.data.error ?? 'Digitization failed'
            : undefined);

    const refine = trpc.form.refineFromRegion.useMutation({
        onSuccess: (data) => {
            setDraft(data);
            setRegion(null);
            setRefineNote('');
            setSelectingRegion(false);
        },
    });

    const createForm = trpc.form.create.useMutation({
        onSuccess: () => setStep('done'),
    });

    const utils = trpc.useUtils();

    const startDigitize = useCallback(
        (base64: string, mime: AcceptedImageMime) => {
            setImageBase64(base64);
            setMimeType(mime);
            setStep('digitize');
            digitize.mutate({ imageBase64: base64, mimeType: mime });
        },
        [digitize],
    );

    const { hasModule, isLoading } = useSubscription();
    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-canvas py-24">
                <FacilityLoader variant="inline" label="forms" />
            </div>
        );
    }
    if (!hasModule('FORMS_AI_DIGITIZE')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
                <UpgradePrompt module="FORMS_AI_DIGITIZE" />
            </div>
        );
    }

    const handleFile = async (file: File) => {
        setUploadError(null);
        try {
            const { base64, mimeType: mime } = await fileToBase64(file);
            const dataUrl = `data:${mime};base64,${base64}`;
            setImageDataUrl(dataUrl);
            startDigitize(base64, mime);
        } catch (error) {
            // e.g. an unsupported format (HEIC) — surface it instead of an
            // unhandled rejection with no UI feedback.
            setUploadError(error instanceof Error ? error.message : 'Failed to read image');
        }
    };

    const handleRefine = async () => {
        if (!draft || !imageBase64) return;
        let cropBase64 = imageBase64;
        let cropMime = mimeType;
        if (region && imageDataUrl) {
            const cropped = await cropImageRegion(imageDataUrl, region);
            cropBase64 = cropped.base64;
            cropMime = cropped.mimeType;
        }
        refine.mutate({
            imageBase64: cropBase64,
            mimeType: cropMime,
            currentDraft: draft,
            region: region ?? undefined,
            userNote: refineNote || undefined,
        });
    };

    const getRelativePoint = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
        };
    };

    const handleSave = () => {
        if (!draft) return;
        createForm.mutate({
            title: draft.title,
            description: draft.description ?? null,
            stage,
            formType: draft.formType,
            schema: draft.schema,
            triggerType,
            fillFrequency,
            sourceImageUrl: imageDataUrl,
        });
    };

    const header = (
        <div className="relative overflow-hidden bg-olive-deep px-4 pb-6 pt-10">
            <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
            <Link to="/app/forms" className="relative mb-4 flex items-center gap-2 text-sm text-bone/70 transition-colors hover:text-bone">
                <Icon name="arrow" width={15} height={15} className="rotate-180" />
                Back to Forms
            </Link>
            <h1 className="relative font-display text-2xl font-extrabold text-bone">Create from Photo</h1>
            <p className="relative mt-1 text-sm text-bone/60">
                {step === 'capture' && 'Take or upload a photo of your paper form'}
                {step === 'digitize' && 'AI is reading your form…'}
                {step === 'verify' && 'Compare your photo with the live form preview'}
                {step === 'workflow' && 'Review the form, then choose when workers fill it'}
                {step === 'done' && 'Form saved'}
            </p>
        </div>
    );

    if (step === 'capture') {
        return (
            <div className="min-h-screen bg-canvas">
                {header}
                <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-olive-deep/30 bg-white p-10 transition-colors hover:border-olive-deep/50">
                        <Icon name="camera" width={48} height={48} className="text-olive-deep" />
                        <span className="font-semibold text-ink">Take photo or choose file</span>
                        <span className="text-center text-sm text-muted">
                            Handwritten and printed forms supported
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleFile(f);
                            }}
                        />
                    </label>
                    {uploadError && (
                        <p role="alert" className="text-center text-sm font-semibold text-rust">
                            {uploadError}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive-deep py-4 font-bold text-bone-light hover:bg-olive-deep/90"
                    >
                        <Icon name="upload" width={20} height={20} />
                        Upload image
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'digitize') {
        return (
            <div className="min-h-screen bg-canvas">
                {header}
                <div className="flex flex-col items-center justify-center py-24 text-muted">
                    <span className="mb-4 h-2 w-2 animate-blink rounded-full bg-rust" />
                    <p className="font-semibold text-ink">Digitizing form with AI…</p>
                    <p className="mt-1 text-sm">This may take 15–30 seconds</p>
                    {digitizeErrorMessage && (
                        <div className="mt-6 max-w-md rounded-xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">
                            <Icon name="thermo" width={20} height={20} className="mr-2 inline" />
                            {digitizeErrorMessage}
                            <button
                                type="button"
                                className="mt-3 block underline"
                                onClick={() => {
                                    setDigitizeJobId(null);
                                    setStep('capture');
                                }}
                            >
                                Try another photo
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (step === 'verify' && draft && imageDataUrl) {
        return (
            <div className="min-h-screen bg-canvas">
                {header}
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 lg:grid lg:grid-cols-2">
                    <div className="order-2 rounded-2xl border border-edge/70 bg-white p-4 shadow-card lg:order-1">
                        <p className="mb-2 kicker">Paper form (original)</p>
                        <div
                            className="relative touch-none select-none"
                            onMouseDown={(e) => {
                                if (!selectingRegion) return;
                                setDragStart(getRelativePoint(e));
                                setRegion(null);
                            }}
                            onMouseMove={(e) => {
                                if (!selectingRegion || !dragStart) return;
                                const p = getRelativePoint(e);
                                setRegion({
                                    x: Math.min(dragStart.x, p.x),
                                    y: Math.min(dragStart.y, p.y),
                                    width: Math.abs(p.x - dragStart.x),
                                    height: Math.abs(p.y - dragStart.y),
                                });
                            }}
                            onMouseUp={() => setDragStart(null)}
                            onMouseLeave={() => setDragStart(null)}
                        >
                            <img
                                ref={imageRef}
                                src={imageDataUrl}
                                alt="Paper form"
                                className="w-full rounded-lg border border-edge/60"
                            />
                            {region && (
                                <div
                                    className="pointer-events-none absolute border-2 border-warn bg-warn/20"
                                    style={{
                                        left: `${region.x * 100}%`,
                                        top: `${region.y * 100}%`,
                                        width: `${region.width * 100}%`,
                                        height: `${region.height * 100}%`,
                                    }}
                                />
                            )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectingRegion((v) => !v);
                                    setRegion(null);
                                }}
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                                    selectingRegion
                                        ? 'border-warn bg-warn/15 text-warn'
                                        : 'border-edge text-ink'
                                }`}
                            >
                                <Icon name="form" width={14} height={14} />
                                {selectingRegion ? 'Drag to highlight wrong area' : 'Mark wrong region'}
                            </button>
                        </div>
                        <textarea
                            className="mt-2 w-full rounded-lg border border-edge p-2 text-sm text-ink"
                            placeholder="Optional note for AI (e.g. fix section 3 labels)"
                            rows={2}
                            value={refineNote}
                            onChange={(e) => setRefineNote(e.target.value)}
                        />
                        <button
                            type="button"
                            disabled={refine.isPending || (!region && !refineNote.trim())}
                            onClick={() => void handleRefine()}
                            className="mt-2 w-full rounded-lg border border-olive-deep py-2 text-sm font-semibold text-olive-deep disabled:opacity-40"
                        >
                            {refine.isPending ? 'Refining…' : 'Re-run AI on highlighted area'}
                        </button>
                    </div>
                    <div className="order-1 rounded-2xl border border-edge/70 bg-white p-4 shadow-card lg:order-2">
                        <p className="mb-2 kicker">Live preview (matches saved form layout)</p>
                        {draft.warnings && draft.warnings.length > 0 && (
                            <div className="mb-3">
                                <DraftWarningsBanner warnings={draft.warnings} />
                            </div>
                        )}
                        <FormDraftLivePreview draft={draft} compact />
                    </div>
                </div>
                <div className="mx-auto max-w-xl px-4 pb-8">
                    <button
                        type="button"
                        onClick={() => setStep('workflow')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive-deep py-4 font-bold text-bone-light hover:bg-olive-deep/90"
                    >
                        Looks good — continue
                        <Icon name="arrow" width={20} height={20} />
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'workflow' && draft) {
        return (
            <div className="min-h-screen bg-canvas">
                {header}
                <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
                    <div className="rounded-2xl border border-edge/70 bg-white p-5 shadow-card">
                        <p className="mb-3 kicker">Final preview before save</p>
                        {draft.warnings && draft.warnings.length > 0 && (
                            <div className="mb-4">
                                <DraftWarningsBanner warnings={draft.warnings} />
                            </div>
                        )}
                        <FormDraftLivePreview draft={draft} />
                    </div>

                    <div className="space-y-4 rounded-2xl border border-edge/70 bg-white p-5 shadow-card">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-olive-deep">
                                Facility area (stage)
                            </label>
                            <select
                                className="w-full rounded-lg border border-edge px-3 py-2.5 text-sm text-ink"
                                value={stage}
                                onChange={(e) => setStage(e.target.value)}
                            >
                                {STAGES.map((s) => (
                                    <option key={s} value={s}>
                                        {s.replace(/_/g, ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-olive-deep">
                                When is this form triggered?
                            </label>
                            <select
                                className="w-full rounded-lg border border-edge px-3 py-2.5 text-sm text-ink"
                                value={triggerType}
                                onChange={(e) =>
                                    setTriggerType(e.target.value as FormTriggerTypeValue)
                                }
                            >
                                {TRIGGER_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-olive-deep">
                                How often is it filled?
                            </label>
                            <select
                                className="w-full rounded-lg border border-edge px-3 py-2.5 text-sm text-ink"
                                value={fillFrequency}
                                onChange={(e) =>
                                    setFillFrequency(e.target.value as FormFillFrequencyValue)
                                }
                            >
                                {FREQUENCY_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="text-center text-xs text-muted">
                        If tables look wrong, go back and re-upload or use &ldquo;Mark wrong region&rdquo; to
                        fix with AI before saving.
                    </p>
                    {createForm.error && (
                        <p className="text-sm text-rust">{createForm.error.message}</p>
                    )}
                    <button
                        type="button"
                        disabled={createForm.isPending}
                        onClick={handleSave}
                        className="w-full rounded-xl bg-olive-deep py-4 font-bold text-bone-light disabled:opacity-50"
                    >
                        {createForm.isPending ? 'Saving…' : 'Save form'}
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'done') {
        return (
            <div className="min-h-screen bg-canvas">
                {header}
                <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
                    <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-live/15 text-live">
                        <Icon name="check" width={32} height={32} />
                    </span>
                    <h2 className="font-display text-xl font-extrabold text-olive-deep">Form created</h2>
                    <p className="mt-2 text-sm text-muted">
                        Workers can fill it from the Forms list. Voice input is on for text fields.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            void utils.form.listByStage.invalidate();
                            navigate('/app/forms');
                        }}
                        className="mt-8 w-full rounded-xl bg-olive-deep py-4 font-bold text-bone-light"
                    >
                        Go to Forms
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
