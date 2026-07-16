import { useEffect } from 'react';
import { useVoiceRecorder } from './useVoiceRecorder';
import { Card } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';

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
        <Card className="h-fit p-6">
            <p className="kicker">voice_recording</p>
            <p className="mt-2 text-sm text-muted">Speak all your animal details in one go.</p>

            {status === 'idle' && (
                <button
                    onClick={startRecording}
                    disabled={isProcessing}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                >
                    <Icon name="mic" width={16} height={16} />
                    Start Recording
                </button>
            )}

            {status === 'recording' && (
                <>
                    <button
                        onClick={stopRecording}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-olive-deep px-4 py-3 text-sm font-semibold text-bone-light transition-colors hover:bg-olive-deep/90"
                    >
                        <Icon name="mic" width={16} height={16} className="animate-blink" />
                        Stop Recording
                    </button>
                    <div className="mt-5 flex h-8 items-end justify-center gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                            <span key={i} className="w-1.5 origin-bottom rounded-full bg-olive animate-bar-eq" style={{ height: '100%', animationDelay: `${i * 0.08}s` }} />
                        ))}
                    </div>
                </>
            )}

            {(status === 'processing' || isProcessing) && (
                <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-bone-light/60 px-4 py-3 text-sm text-muted">
                    <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
                    Processing…
                </div>
            )}

            {error && (
                <p className="mt-4 rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">{error}</p>
            )}
        </Card>
    );
}
