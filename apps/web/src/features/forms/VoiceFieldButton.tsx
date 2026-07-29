import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/trpc';
import { useVoiceRecorder } from '../farmer-registration/useVoiceRecorder';
import type { FieldType } from '@bin-tracker/types';

interface VoiceFieldButtonProps {
    fieldId: string;
    fieldLabel: string;
    fieldType?: FieldType;
    /** Allowed values for select/radio, so extraction snaps to an exact option. */
    fieldOptions?: string[];
    onValue: (value: string) => void;
    disabled?: boolean;
}

export function VoiceFieldButton({
    fieldId,
    fieldLabel,
    fieldType,
    fieldOptions,
    onValue,
    disabled,
}: VoiceFieldButtonProps) {
    const { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio } =
        useVoiceRecorder();

    const transcribe = useMutation({
        mutationFn: (input: Parameters<typeof apiClient.form.transcribeField.mutate>[0]) =>
            apiClient.form.transcribeField.mutate(input),
        onSuccess: (data) => {
            if (data.value) onValue(data.value);
            clearAudio();
        },
    });

    useEffect(() => {
        if (!audioBase64 || transcribe.isPending) return;
        transcribe.mutate({
            audioBase64,
            mimeType,
            fieldId,
            fieldLabel,
            fieldType,
            fieldOptions,
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBase64]);

    const busy = status === 'processing' || transcribe.isPending;

    if (status === 'recording') {
        return (
            <button
                type="button"
                onClick={stopRecording}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rust px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-rust/90 disabled:opacity-50"
                title="Stop and fill field"
            >
                <MicOff className="h-3.5 w-3.5 animate-pulse" />
                Stop
            </button>
        );
    }

    if (busy) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Listening…
            </span>
        );
    }

    return (
        <div className="inline-flex flex-col items-end gap-0.5">
            <button
                type="button"
                onClick={() => void startRecording()}
                disabled={disabled || transcribe.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-olive-deep/20 bg-bone-light px-3 py-1.5 text-xs font-semibold text-olive-deep hover:bg-bone disabled:opacity-50"
                title="Speak to fill this field"
            >
                <Mic className="h-3.5 w-3.5" />
                Voice
            </button>
            {(error || transcribe.error) && (
                <span className="text-[10px] text-rust max-w-[140px] text-right">
                    {error ?? transcribe.error?.message}
                </span>
            )}
        </div>
    );
}
