import { useState, useRef, useCallback } from 'react';

type RecordingStatus = 'idle' | 'recording' | 'processing';

interface UseVoiceRecorderResult {
    status: RecordingStatus;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    audioBase64: string | null;
    mimeType: 'audio/webm' | 'audio/mp4';
    error: string | null;
    clearAudio: () => void;
}

function getSupportedMimeType(): 'audio/webm' | 'audio/mp4' {
    return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mimeType = getSupportedMimeType();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        setError(null);
        setAudioBase64(null);
        chunksRef.current = [];

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError('Microphone access denied. Please allow microphone permission and try again.');
            return;
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1] ?? '';
                setAudioBase64(base64);
                setStatus('idle');
            };
            reader.readAsDataURL(blob);

            // Stop all microphone tracks to release the mic
            stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        setStatus('recording');
    }, [mimeType]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            setStatus('processing');
            mediaRecorderRef.current.stop();
        }
    }, []);

    const clearAudio = useCallback(() => {
        setAudioBase64(null);
        setError(null);
        setStatus('idle');
    }, []);

    return { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio };
}
