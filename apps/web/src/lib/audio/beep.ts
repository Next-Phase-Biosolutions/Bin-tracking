/**
 * Short confirmation tones for hands-free recording, plus the shared AudioContext.
 *
 * One context for the page lifetime, primed on a real user gesture. Two reasons:
 * a Media Session action handler does not reliably confer user activation, so a
 * context created inside the headset-button handler can be stuck 'suspended' and
 * the beep silently never plays; and browsers cap concurrent AudioContexts (~6),
 * so one per recording exhausts the pool.
 */

const START_HZ = 880;
const STOP_HZ = 523;
const BEEP_MS = 120;
const PEAK_GAIN = 0.25;
const RAMP_S = 0.01;

let context: AudioContext | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;
    if (!context) context = new Ctor();
    return context;
}

/**
 * Call from a real user gesture (a tap) before relying on beeps. Safe to call
 * repeatedly.
 */
export async function primeAudio(): Promise<void> {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch {
            // Autoplay policy refused; beeps degrade to silent.
        }
    }
}

/**
 * Distinct start/stop tones so a worker can tell them apart without looking.
 * Both sit well under 3.5 kHz so they stay audible over a narrowband HFP link.
 */
export function beep(kind: 'start' | 'stop'): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    // A context created outside a user gesture starts 'suspended', and priming it is
    // async — so a beep fired on the same tap can arrive before the resume lands.
    // Resume and then emit rather than dropping the tone silently.
    if (ctx.state === 'suspended') {
        void ctx
            .resume()
            .then(() => emit(ctx, kind))
            .catch(() => {
                // Autoplay policy refused; nothing further to try.
            });
        return;
    }
    emit(ctx, kind);
}

function emit(ctx: AudioContext, kind: 'start' | 'stop'): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'start' ? START_HZ : STOP_HZ;

    const now = ctx.currentTime;
    const duration = BEEP_MS / 1000;
    // Ramp in and out; a square-edged gate on a sine is an audible click.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + RAMP_S);
    gain.gain.setValueAtTime(PEAK_GAIN, now + duration - RAMP_S);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + duration);
}
