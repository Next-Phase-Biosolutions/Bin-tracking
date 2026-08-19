import { useState, useRef, useCallback, useEffect } from 'react';
import { beep, getAudioContext, primeAudio } from '../../lib/audio/beep';
import { rms, createSilenceGate } from '../../lib/audio/silence';

type RecordingStatus = 'idle' | 'recording' | 'processing';

export interface UseVoiceRecorderOptions {
    /** Stop automatically after this much silence. Omit for manual stop only. */
    autoStopSilenceMs?: number;
    /** Hard ceiling on a single recording. */
    maxDurationMs?: number;
    /** Play distinct tones on start and stop. */
    beep?: boolean;
}

interface UseVoiceRecorderResult {
    status: RecordingStatus;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    audioBase64: string | null;
    mimeType: 'audio/webm' | 'audio/mp4';
    error: string | null;
    clearAudio: () => void;
}

const DEFAULT_MAX_DURATION_MS = 60_000;
const POLL_MS = 100;

// Silence-detection tuning. These are physical-world knobs — expect to adjust them
// against the real room and headset rather than trusting the defaults.
const SILENCE_THRESHOLD_MULTIPLIER = 2.5;
const SILENCE_FLOOR = 0.01;
const CALIBRATE_MS = 300;

// getUserMedia triggers an A2DP->HFP renegotiation on a Bluetooth headset. Wait for the
// link to settle before capturing so the switch artifact does not land at the head of the
// recording. The start beep deliberately fires BEFORE all this: it is instant feedback for
// the press, and playing it pre-switch is the only way to guarantee it is audible, since
// headset audio is muted for 200-500ms during the renegotiation.
const HFP_SETTLE_MS = 300;

function getSupportedMimeType(): 'audio/webm' | 'audio/mp4' {
    return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderResult {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mimeType = getSupportedMimeType();

    // Options are read inside callbacks that must not be re-created, so they live in a ref.
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const pollTimerRef = useRef<number | null>(null);
    const maxTimerRef = useRef<number | null>(null);
    // Synchronous latch. Guarding on `status` does not work: setStatus resolves after the
    // getUserMedia await, so two rapid calls both pass an `idle` check and open two mic
    // streams, orphaning the first recorder with its tracks still live.
    const startingRef = useRef(false);
    const unmountedRef = useRef(false);

    const clearTimers = useCallback(() => {
        if (pollTimerRef.current !== null) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        if (maxTimerRef.current !== null) {
            window.clearTimeout(maxTimerRef.current);
            maxTimerRef.current = null;
        }
    }, []);

    const teardownAudioGraph = useCallback(() => {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        sourceRef.current = null;
        analyserRef.current = null;
        // The AudioContext itself is shared and deliberately left open.
    }, []);

    const releaseStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const stopRecording = useCallback(() => {
        clearTimers();
        if (mediaRecorderRef.current?.state !== 'recording') return;
        setStatus('processing');
        mediaRecorderRef.current.stop();
    }, [clearTimers]);

    const watchForSilence = useCallback(
        (stream: MediaStream, silenceMs: number) => {
            const ctx = getAudioContext();
            if (!ctx) return; // No Web Audio: the max-duration cap is the only backstop.

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser); // Read-only tap; never connected to destination.
            sourceRef.current = source;
            analyserRef.current = analyser;

            const samples = new Float32Array(analyser.fftSize);
            const gate = createSilenceGate({
                silenceMs,
                thresholdMultiplier: SILENCE_THRESHOLD_MULTIPLIER,
                floor: SILENCE_FLOOR,
                calibrateMs: CALIBRATE_MS,
            });

            pollTimerRef.current = window.setInterval(() => {
                analyser.getFloatTimeDomainData(samples);
                if (gate.push(rms(samples), POLL_MS) === 'stop') stopRecording();
            }, POLL_MS);
        },
        [stopRecording],
    );

    const startRecording = useCallback(async () => {
        if (startingRef.current || mediaRecorderRef.current?.state === 'recording') return;
        startingRef.current = true;

        setError(null);
        setAudioBase64(null);
        chunksRef.current = [];

        try {
            const { autoStopSilenceMs, maxDurationMs, beep: beepEnabled } = optionsRef.current;
            const handsFree = Boolean(autoStopSilenceMs || beepEnabled);

            // Fire the moment the press lands: confirms "I heard you" with no dead time,
            // and on Bluetooth it reaches the ear before the profile switch mutes output.
            if (beepEnabled) {
                void primeAudio();
                beep('start');
            }

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        // autoGainControl amplifies quiet input toward a target level, which
                        // during a pause boosts room noise back up so the level never drops
                        // and auto-stop never fires. It must be off for silence detection.
                        autoGainControl: false,
                        // Kept on deliberately: it gates ambient toward zero during pauses,
                        // which makes the silence signal cleaner.
                        noiseSuppression: true,
                        echoCancellation: true,
                    },
                });
            } catch {
                setError('Microphone access denied. Please allow microphone permission and try again.');
                return;
            }

            if (unmountedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            streamRef.current = stream;

            if (handsFree) await delay(HFP_SETTLE_MS);

            if (unmountedRef.current) {
                releaseStream();
                return;
            }

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e: BlobEvent) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                // Beep here rather than alongside stopRecording() so the tone cannot be
                // captured by a recorder that has not finished flushing.
                if (optionsRef.current.beep) beep('stop');
                clearTimers();
                teardownAudioGraph();

                const blob = new Blob(chunksRef.current, { type: mimeType });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1] ?? '';
                    setAudioBase64(base64);
                    setStatus('idle');
                };
                reader.readAsDataURL(blob);

                releaseStream();
            };

            recorder.start();
            setStatus('recording');

            if (autoStopSilenceMs) watchForSilence(stream, autoStopSilenceMs);

            // Backstop: if the room never drops below threshold, silence detection never
            // fires and the recording would run forever.
            maxTimerRef.current = window.setTimeout(
                stopRecording,
                maxDurationMs ?? DEFAULT_MAX_DURATION_MS,
            );
        } finally {
            startingRef.current = false;
        }
    }, [mimeType, clearTimers, teardownAudioGraph, releaseStream, stopRecording, watchForSilence]);

    const clearAudio = useCallback(() => {
        setAudioBase64(null);
        setError(null);
        setStatus('idle');
    }, []);

    useEffect(() => {
        // Reset on every mount. StrictMode runs mount -> cleanup -> mount in dev, so
        // without this the cleanup below latches the flag on permanently and every
        // subsequent startRecording aborts silently right after opening the mic.
        unmountedRef.current = false;
        return () => {
            unmountedRef.current = true;
            clearTimers();
            teardownAudioGraph();
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== 'inactive') {
                recorder.onstop = null; // Never setState after unmount.
                recorder.stop();
            }
            mediaRecorderRef.current = null;
            releaseStream();
        };
    }, [clearTimers, teardownAudioGraph, releaseStream]);

    return { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio };
}
