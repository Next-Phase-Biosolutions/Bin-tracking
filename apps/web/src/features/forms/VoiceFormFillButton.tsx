import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '../../lib/trpc';
import type { FormVoiceFillResult } from '@bin-tracker/types';
import { useVoiceRecorder } from '../farmer-registration/useVoiceRecorder';

interface VoiceFormFillButtonProps {
    formId: string;
    onFill: (result: FormVoiceFillResult) => void;
}

/**
 * Top-of-form button: record one utterance describing the whole form, send it
 * to `form.fillByVoice`, and hand the routed result back to the renderer, which
 * populates fields and flags low-confidence values. Mirrors VoiceFieldButton's
 * record → processing → error states, at form scope.
 */
export function VoiceFormFillButton({ formId, onFill }: VoiceFormFillButtonProps) {
    const { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio } =
        useVoiceRecorder();

    const fill = useMutation({
        mutationFn: (input: Parameters<typeof apiClient.form.fillByVoice.mutate>[0]) =>
            apiClient.form.fillByVoice.mutate(input),
        onSuccess: (data) => {
            onFill(data);
            clearAudio();
        },
    });

    useEffect(() => {
        if (!audioBase64 || fill.isPending) return;
        fill.mutate({ formId, audioBase64, mimeType });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBase64]);

    const busy = status === 'processing' || fill.isPending;

    return (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[#043F2E]/20 bg-[#F5F8F2] p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#043F2E]" />
                    <div>
                        <p className="text-sm font-bold text-[#043F2E]">Fill form by voice</p>
                        <p className="text-xs text-gray-500">
                            Speak once — say the fields and one table row. Unclear values get flagged.
                        </p>
                    </div>
                </div>

                {status === 'recording' ? (
                    <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                        <MicOff className="h-4 w-4 animate-pulse" />
                        Stop
                    </button>
                ) : busy ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 px-3 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Filling…
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={() => void startRecording()}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#043F2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#032f22]"
                    >
                        <Mic className="h-4 w-4" />
                        Speak
                    </button>
                )}
            </div>
            {(error || fill.error) && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                    {error ?? fill.error?.message}
                </p>
            )}
        </div>
    );
}
