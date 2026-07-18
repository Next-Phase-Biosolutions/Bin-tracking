import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../lib/trpc';
import { AnimalForm } from './AnimalForm';
import { VoiceRecorder } from './VoiceRecorder';
import type { ExtractedAnimalFields } from '@bin-tracker/validators';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { Icon } from '../../components/ui/Icon';

const EMPTY_FIELDS: ExtractedAnimalFields = {
    animalType: null,
    breed: null,
    age: null,
    weight: null,
    ownerName: null,
    healthCondition: null,
};

export default function FarmerRegistrationPage() {
    const [formFields, setFormFields] = useState<ExtractedAnimalFields>({ ...EMPTY_FIELDS });
    const [transcriptLog, setTranscriptLog] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcribeError, setTranscribeError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const transcribeMutation = useMutation({
        mutationFn: (input: Parameters<typeof apiClient.farmer.transcribe.mutate>[0]) =>
            apiClient.farmer.transcribe.mutate(input),
    });
    const registerMutation = useMutation({
        mutationFn: (input: Parameters<typeof apiClient.farmer.register.mutate>[0]) =>
            apiClient.farmer.register.mutate(input),
    });

    // Called by VoiceRecorder once audio blob is base64-encoded and ready
    const handleAudioReady = useCallback(
        (audioBase64: string, mimeType: 'audio/webm' | 'audio/mp4') => {
            setIsProcessing(true);
            setTranscribeError(null);

            transcribeMutation.mutate(
                { audioBase64, mimeType },
                {
                    onSuccess: (data) => {
                        setTranscriptLog((prev) => [...prev, data.transcript]);
                        setFormFields((prev) => {
                            const next = { ...prev };
                            for (const [key, val] of Object.entries(data.fields)) {
                                if (val !== null) {
                                    next[key as keyof ExtractedAnimalFields] = val;
                                }
                            }
                            return next;
                        });
                        setIsProcessing(false);
                    },
                    onError: (err) => {
                        setTranscribeError(err.message);
                        setIsProcessing(false);
                    },
                },
            );
        },
        [transcribeMutation],
    );

    const { hasModule, isLoading } = useSubscription();
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <FacilityLoader variant="inline" label="registration" />
            </div>
        );
    }
    if (!hasModule('ANIMAL_INTAKE')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
                <UpgradePrompt module="ANIMAL_INTAKE" />
            </div>
        );
    }

    const handleFieldChange = (field: keyof ExtractedAnimalFields, value: string) => {
        setFormFields((prev) => ({ ...prev, [field]: value || null }));
    };

    const handleSubmit = () => {
        if (!formFields.animalType || !formFields.ownerName) return;

        setIsSubmitting(true);
        setSubmitSuccess(false);

        registerMutation.mutate(
            {
                animalType: formFields.animalType,
                breed: formFields.breed ?? undefined,
                age: formFields.age ?? undefined,
                weight: formFields.weight ?? undefined,
                ownerName: formFields.ownerName,
                healthCondition: formFields.healthCondition ?? undefined,
                rawTranscript: transcriptLog.join(' | ') || undefined,
            },
            {
                onSuccess: () => {
                    setSubmitSuccess(true);
                    setFormFields({ ...EMPTY_FIELDS });
                    setTranscriptLog([]);
                    setIsSubmitting(false);
                },
                onError: () => {
                    setIsSubmitting(false);
                },
            },
        );
    };

    return (
        <div className="min-h-screen bg-canvas p-6">
            <div aria-hidden className="pointer-events-none fixed inset-0 data-grid-bg opacity-40" />
            <div className="relative mx-auto max-w-5xl">
                <PageHeader
                    title="Farmer Animal Registration"
                    subtitle="Record your answers by voice — the form will fill automatically."
                    icon={<Icon name="cow" width={22} height={22} />}
                />

                {transcribeError && (
                    <div className="mb-4 rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                        {transcribeError}
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    {/* Left — Form */}
                    <AnimalForm
                        fields={formFields}
                        onChange={handleFieldChange}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                        submitSuccess={submitSuccess}
                    />

                    {/* Right — Voice Recorder */}
                    <VoiceRecorder
                        onAudioReady={handleAudioReady}
                        isProcessing={isProcessing}
                    />
                </div>
            </div>
        </div>
    );
}
