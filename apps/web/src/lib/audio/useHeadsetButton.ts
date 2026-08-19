import { useEffect, useRef } from 'react';
import { primeAudio } from './beep';

/**
 * Maps a Bluetooth headset's play/pause button to a callback, via the Media Session API.
 *
 * Browsers only route hardware media keys to a page that is actively playing media, so
 * this holds a silent looping <audio> element to claim the session. A real media element
 * is required — Web Audio output alone does not claim one.
 *
 * Android and desktop Chrome/Edge only. iOS keeps headset buttons at the system level and
 * never forwards them to Safari; there the hook is a no-op and the on-screen button is the
 * only control.
 */

const PRESS_DEBOUNCE_MS = 500;

// Chrome only grants a media session to audio it treats as significant; a very short clip
// can be ignored outright. Ten seconds of silence clears that comfortably. Generated at
// runtime rather than inlined as base64 so it costs nothing in the bundle.
const KEEPALIVE_SECONDS = 10;

function createSilentWavUrl(seconds: number): string {
    const rate = 8000;
    const samples = Math.floor(rate * seconds);
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const writeAscii = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, rate, true);
    view.setUint32(28, rate, true); // byte rate: 8-bit mono, so same as sample rate
    view.setUint16(32, 1, true); // block align
    view.setUint16(34, 8, true); // bits per sample
    writeAscii(36, 'data');
    view.setUint32(40, samples, true);
    new Uint8Array(buffer, 44).fill(128); // silence in 8-bit PCM is 128, not 0

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

interface UseHeadsetButtonOptions {
    /** Fired on a headset button press. */
    onPress: () => void;
    /** When false, presses are ignored — but the media session is still held. */
    enabled: boolean;
}

export function useHeadsetButton({ onPress, enabled }: UseHeadsetButtonOptions): void {
    // setActionHandler captures its callback at registration time. Registering once with
    // an inline closure would freeze the first render's onPress and enabled, so both are
    // routed through refs that stay current.
    const onPressRef = useRef(onPress);
    onPressRef.current = onPress;
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    useEffect(() => {
        const session = navigator.mediaSession;
        if (!session) return;

        const url = createSilentWavUrl(KEEPALIVE_SECONDS);
        const keepAlive = new Audio(url);
        keepAlive.loop = true;
        let tearingDown = false;
        let lastPressAt = 0;

        const play = () => {
            keepAlive.play().catch(() => {
                // Autoplay policy: needs a user gesture. Retried on the next tap below.
            });
        };

        // Opening the mic flips the headset into HFP, which can stall the A2DP stream and
        // pause this element. If it stays paused the media session is lost and the *next*
        // button press never arrives, so restart it whenever it pauses unexpectedly.
        const onPause = () => {
            if (!tearingDown) play();
        };

        // One shared first-gesture handler: unblocks both the keep-alive element and the
        // AudioContext used for beeps. Hands-free means the on-screen button may never be
        // tapped, so this cannot live on that button's onClick.
        const onFirstGesture = () => {
            void primeAudio();
            play();
        };

        const handlePress = () => {
            const now = Date.now();
            // A single physical press can fire both 'play' and 'pause'. Without this the
            // callback runs twice, which for startRecording means two mic streams.
            if (now - lastPressAt < PRESS_DEBOUNCE_MS) return;
            lastPressAt = now;
            if (enabledRef.current) onPressRef.current();
        };

        keepAlive.addEventListener('pause', onPause);
        document.addEventListener('pointerdown', onFirstGesture);
        play();

        // Present in every browser that has mediaSession, but guard rather than risk a
        // throw that would take the whole panel down.
        if (typeof MediaMetadata !== 'undefined') {
            session.metadata = new MediaMetadata({ title: 'Voice form fill', artist: 'Bin Tracker' });
        }
        session.playbackState = 'playing';
        // Which action a headset sends depends on what it believes is currently playing,
        // so both map to the same "pressed" meaning.
        session.setActionHandler('play', handlePress);
        session.setActionHandler('pause', handlePress);

        return () => {
            tearingDown = true;
            session.setActionHandler('play', null);
            session.setActionHandler('pause', null);
            session.playbackState = 'none';
            keepAlive.removeEventListener('pause', onPause);
            document.removeEventListener('pointerdown', onFirstGesture);
            keepAlive.pause();
            keepAlive.src = '';
            URL.revokeObjectURL(url);
        };
    }, []);
}
