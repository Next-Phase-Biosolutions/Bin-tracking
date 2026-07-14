import { useEffect, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from './useVoiceRecorder';

interface VoiceRecorderProps {
    onAudioReady: (audioBase64: string, mimeType: 'audio/webm' | 'audio/mp4') => void;
    isProcessing: boolean;
}

export function VoiceRecorder({ onAudioReady, isProcessing }: VoiceRecorderProps) {
    const { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio } =
        useVoiceRecorder();

    useEffect(() => {
        if (!audioBase64) return;
        onAudioReady(audioBase64, mimeType);
        clearAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBase64]);

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Voice Recording
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                    Speak all your animal details in one go.
                </p>

                {status === 'idle' && (
                    <button
                        onClick={startRecording}
                        disabled={isProcessing}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                        <Mic className="h-4 w-4" />
                        Start Recording
                    </button>
                )}

                {status === 'recording' && (
                    <button
                        onClick={stopRecording}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                        <MicOff className="h-4 w-4 animate-pulse" />
                        Stop Recording
                    </button>
                )}

                {(status === 'processing' || isProcessing) && (
                    <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                    </div>
                )}
            </div>

            {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
        </div>
    );
}
