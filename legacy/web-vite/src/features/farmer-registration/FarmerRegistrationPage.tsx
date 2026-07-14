import { useState, useCallback } from 'react';
import { trpc } from '../../lib/trpc';
import { AnimalForm } from './AnimalForm';
import { VoiceRecorder } from './VoiceRecorder';
import type { ExtractedAnimalFields } from '@bin-tracker/validators';

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

    const transcribeMutation = trpc.farmer.transcribe.useMutation();
    const registerMutation = trpc.farmer.register.useMutation();

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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Farmer Animal Registration</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Record your answers by voice — the form will fill automatically.
                    </p>
                </div>

                {transcribeError && (
                    <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                        {transcribeError}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
