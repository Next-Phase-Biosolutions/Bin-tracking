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
        <div className="flex flex-col gap-1.5 rounded-2xl border border-olive-deep/20 bg-bone-light p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-olive-deep" />
                    <div>
                        <p className="text-sm font-bold text-olive-deep">Fill form by voice</p>
                        <p className="text-xs text-muted">
                            Speak once — say the fields and one table row. Unclear values get flagged.
                        </p>
                    </div>
                </div>

                {status === 'recording' ? (
                    <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-canvas hover:bg-rust/90"
                    >
                        <MicOff className="h-4 w-4 animate-pulse" />
                        Stop
                    </button>
                ) : busy ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 px-3 text-sm text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Filling…
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={() => void startRecording()}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-olive-deep px-4 py-2 text-sm font-semibold text-bone-light hover:bg-olive-deep/90"
                    >
                        <Mic className="h-4 w-4" />
                        Speak
                    </button>
                )}
            </div>
            {(error || fill.error) && (
                <p role="alert" className="text-xs font-semibold text-rust">
                    {error ?? fill.error?.message}
                </p>
            )}
        </div>
    );
}
