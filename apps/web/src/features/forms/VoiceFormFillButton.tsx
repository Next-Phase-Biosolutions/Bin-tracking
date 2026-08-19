import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mic, MicOff, Loader2, Sparkles, Headphones } from 'lucide-react';
import { apiClient } from '../../lib/trpc';
import type { FormVoiceFillResult } from '@bin-tracker/types';
import { useVoiceRecorder } from '../farmer-registration/useVoiceRecorder';
import { useHeadsetButton } from '../../lib/audio/useHeadsetButton';
import { useWakeLock } from '../../lib/audio/useWakeLock';

interface VoiceFormFillButtonProps {
    formId: string;
    onFill: (result: FormVoiceFillResult) => void;
    /** What's worth saying on this form type. Defaults to the table-form phrasing. */
    hint?: string;
}

/** Stop once the worker has been quiet this long. */
const SILENCE_STOP_MS = 3500;
/** Ceiling on one utterance, in case the room is too loud for silence to ever register. */
const MAX_RECORDING_MS = 60_000;

/**
 * Top-of-form button: record one utterance describing the whole form, send it
 * to `form.fillByVoice`, and hand the routed result back to the renderer, which
 * populates fields and flags low-confidence values.
 *
 * Hands-free path: the worker presses their headset button to start, and recording ends
 * itself after a few seconds of silence. Stop is deliberately never bound to the headset
 * button — once the mic is open the headset is in HFP mode, where some models let the OS
 * capture the button for call control so it never reaches the browser. The on-screen
 * buttons remain as the fallback for both.
 */
export function VoiceFormFillButton({
    formId,
    onFill,
    hint = 'Speak once — say the fields and one table row. Unclear values get flagged.',
}: VoiceFormFillButtonProps) {
    const { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio } =
        useVoiceRecorder({
            autoStopSilenceMs: SILENCE_STOP_MS,
            maxDurationMs: MAX_RECORDING_MS,
            beep: true,
        });

    const fill = useMutation({
        mutationFn: (input: Parameters<typeof apiClient.form.fillByVoice.mutate>[0]) =>
            apiClient.form.fillByVoice.mutate(input),
        onSuccess: (data) => {
            onFill(data);
            clearAudio();
        },
    });

    const busy = status === 'processing' || fill.isPending;

    useHeadsetButton({ onPress: () => void startRecording(), enabled: status === 'idle' && !busy });
    useWakeLock();

    // Tracked explicitly rather than relying on audioBase64 identity: with auto-stop a
    // second recording can finish while the first submit is still in flight, and keying
    // only off audioBase64 would drop it silently.
    const submittedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!audioBase64 || fill.isPending) return;
        if (submittedRef.current === audioBase64) return;
        submittedRef.current = audioBase64;
        fill.mutate({ formId, audioBase64, mimeType });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBase64, fill.isPending]);

    return (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-olive-deep/20 bg-bone-light p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-olive-deep" />
                    <div>
                        <p className="text-sm font-bold text-olive-deep">Fill form by voice</p>
                        <p className="text-xs text-muted">{hint}</p>
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

            <p className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Headphones className="h-3.5 w-3.5 shrink-0" />
                {status === 'recording'
                    ? 'Listening — stops on its own a few seconds after you finish.'
                    : 'Or press the button on your headset to start.'}
            </p>

            {(error || fill.error) && (
                <p role="alert" className="text-xs font-semibold text-rust">
                    {error ?? fill.error?.message}
                </p>
            )}
        </div>
    );
}
