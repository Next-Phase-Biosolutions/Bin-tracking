import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Camera,
    Upload,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Highlighter,
} from 'lucide-react';
import type { FormDigitizeDraft, FormFillFrequencyValue, FormTriggerTypeValue } from '@bin-tracker/types';
import { trpc } from '../../../lib/trpc';
import { fileToBase64, cropImageRegion } from './image-utils';
import { FormDraftLivePreview } from './FormDraftLivePreview';
import { useSubscription } from '../../../context/SubscriptionContext';
import { UpgradePrompt } from '../../../components/UpgradePrompt';

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
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <p className="font-semibold mb-1">Structure adjusted to match the paper table layout</p>
            <ul className="list-disc pl-4 space-y-0.5">
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
    const [mimeType, setMimeType] = useState('image/jpeg');
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

    const digitize = trpc.form.digitizeFromPhoto.useMutation({
        onSuccess: (data) => {
            setDraft(data);
            setStep('verify');
        },
    });

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
        (base64: string, mime: string) => {
            setImageBase64(base64);
            setMimeType(mime);
            setStep('digitize');
            digitize.mutate({ imageBase64: base64, mimeType: mime });
        },
        [digitize],
    );

    const { hasModule } = useSubscription();
    if (!hasModule('FORMS_AI_DIGITIZE')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <UpgradePrompt module="FORMS_AI_DIGITIZE" />
            </div>
        );
    }

    const handleFile = async (file: File) => {
        const { base64, mimeType: mime } = await fileToBase64(file);
        const dataUrl = `data:${mime};base64,${base64}`;
        setImageDataUrl(dataUrl);
        startDigitize(base64, mime);
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
        <div className="bg-[#043F2E] px-4 pt-10 pb-6">
            <Link
                to="/app/forms"
                className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Forms
            </Link>
            <h1 className="text-2xl font-bold text-white">Create from Photo</h1>
            <p className="text-white/60 text-sm mt-1">
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
            <div className="min-h-screen bg-[#F5F8F2]">
                {header}
                <div className="px-4 py-8 max-w-xl mx-auto flex flex-col gap-4">
                    <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#043F2E]/30 bg-white p-10 cursor-pointer hover:border-[#043F2E]/50 transition-colors">
                        <Camera className="w-12 h-12 text-[#043F2E]" />
                        <span className="font-semibold text-gray-900">Take photo or choose file</span>
                        <span className="text-sm text-gray-500 text-center">
                            Handwritten and printed forms supported
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleFile(f);
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 w-full bg-[#043F2E] text-white py-4 rounded-xl font-bold"
                    >
                        <Upload className="w-5 h-5" />
                        Upload image
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'digitize') {
        return (
            <div className="min-h-screen bg-[#F5F8F2]">
                {header}
                <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin text-[#043F2E] mb-4" />
                    <p className="font-semibold">Digitizing form with AI…</p>
                    <p className="text-sm mt-1">This may take 15–30 seconds</p>
                    {digitize.error && (
                        <div className="mt-6 max-w-md rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
                            <AlertCircle className="w-5 h-5 inline mr-2" />
                            {digitize.error.message}
                            <button
                                type="button"
                                className="block mt-3 underline"
                                onClick={() => setStep('capture')}
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
            <div className="min-h-screen bg-[#F5F8F2]">
                {header}
                <div className="px-4 py-6 max-w-6xl mx-auto flex flex-col gap-4 lg:grid lg:grid-cols-2">
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm order-2 lg:order-1">
                        <p className="text-xs font-bold uppercase text-gray-500 mb-2">Paper form (original)</p>
                        <div
                            className="relative select-none touch-none"
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
                                className="w-full rounded-lg border border-gray-100"
                            />
                            {region && (
                                <div
                                    className="absolute border-2 border-amber-400 bg-amber-400/20 pointer-events-none"
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
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border ${
                                    selectingRegion
                                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                                        : 'border-gray-300 text-gray-700'
                                }`}
                            >
                                <Highlighter className="w-3.5 h-3.5" />
                                {selectingRegion ? 'Drag to highlight wrong area' : 'Mark wrong region'}
                            </button>
                        </div>
                        <textarea
                            className="mt-2 w-full text-sm border border-gray-200 rounded-lg p-2"
                            placeholder="Optional note for AI (e.g. fix section 3 labels)"
                            rows={2}
                            value={refineNote}
                            onChange={(e) => setRefineNote(e.target.value)}
                        />
                        <button
                            type="button"
                            disabled={refine.isPending || (!region && !refineNote.trim())}
                            onClick={() => void handleRefine()}
                            className="mt-2 w-full text-sm font-semibold py-2 rounded-lg border border-[#043F2E] text-[#043F2E] disabled:opacity-40"
                        >
                            {refine.isPending ? 'Refining…' : 'Re-run AI on highlighted area'}
                        </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm order-1 lg:order-2">
                        <p className="text-xs font-bold uppercase text-gray-500 mb-2">
                            Live preview (matches saved form layout)
                        </p>
                        {draft.warnings && draft.warnings.length > 0 && (
                            <div className="mb-3">
                                <DraftWarningsBanner warnings={draft.warnings} />
                            </div>
                        )}
                        <FormDraftLivePreview draft={draft} compact />
                    </div>
                </div>
                <div className="px-4 pb-8 max-w-xl mx-auto">
                    <button
                        type="button"
                        onClick={() => setStep('workflow')}
                        className="w-full flex items-center justify-center gap-2 bg-[#043F2E] text-white py-4 rounded-xl font-bold"
                    >
                        Looks good — continue
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'workflow' && draft) {
        return (
            <div className="min-h-screen bg-[#F5F8F2]">
                {header}
                <div className="px-4 py-6 max-w-5xl mx-auto flex flex-col gap-5">
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase text-gray-500 mb-3">
                            Final preview before save
                        </p>
                        {draft.warnings && draft.warnings.length > 0 && (
                            <div className="mb-4">
                                <DraftWarningsBanner warnings={draft.warnings} />
                            </div>
                        )}
                        <FormDraftLivePreview draft={draft} />
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Facility area (stage)
                            </label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
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
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                When is this form triggered?
                            </label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
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
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                How often is it filled?
                            </label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
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
                    <p className="text-xs text-gray-500 text-center">
                        If tables look wrong, go back and re-upload or use &ldquo;Mark wrong region&rdquo; to
                        fix with AI before saving.
                    </p>
                    {createForm.error && (
                        <p className="text-sm text-red-600">{createForm.error.message}</p>
                    )}
                    <button
                        type="button"
                        disabled={createForm.isPending}
                        onClick={handleSave}
                        className="w-full bg-[#043F2E] text-white py-4 rounded-xl font-bold disabled:opacity-50"
                    >
                        {createForm.isPending ? 'Saving…' : 'Save form'}
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'done') {
        return (
            <div className="min-h-screen bg-[#F5F8F2]">
                {header}
                <div className="flex flex-col items-center py-16 px-4 max-w-md mx-auto text-center">
                    <CheckCircle2 className="w-16 h-16 text-green-600 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900">Form created</h2>
                    <p className="text-gray-600 text-sm mt-2">
                        Workers can fill it from the Forms list. Voice input is on for text fields.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            void utils.form.listByStage.invalidate();
                            navigate('/app/forms');
                        }}
                        className="mt-8 w-full bg-[#043F2E] text-white py-4 rounded-xl font-bold"
                    >
                        Go to Forms
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
