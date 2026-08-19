/**
 * Level-based silence detection for auto-stopping a voice recording.
 *
 * Kept pure (no Web Audio types) so the decision logic is testable without mocking
 * AudioContext. The caller feeds it RMS levels; it decides when to stop.
 */

/** Root-mean-square amplitude of a frame of time-domain samples (-1..1). */
export function rms(samples: Float32Array): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
}

export interface SilenceGateOptions {
    /** Quiet time required before stopping, once the speaker has actually spoken. */
    silenceMs: number;
    /** Speech threshold = ambient x this. */
    thresholdMultiplier: number;
    /** Absolute floor for the threshold, so a near-silent room stays sane. */
    floor: number;
    /** Time spent measuring ambient level before the gate arms. */
    calibrateMs: number;
}

export interface SilenceGate {
    /**
     * Feed one frame. Returns 'stop' once the speaker has spoken and then gone
     * quiet for `silenceMs`.
     */
    push(level: number, dtMs: number): 'continue' | 'stop';
    /** Resolved speech threshold, or null while still calibrating. Exposed for tuning. */
    readonly threshold: number | null;
    /** Whether speech has been detected yet. Exposed for UI and tuning. */
    readonly hasSpoken: boolean;
}

export function createSilenceGate(opts: SilenceGateOptions): SilenceGate {
    const { silenceMs, thresholdMultiplier, floor, calibrateMs } = opts;

    let elapsedCalibrationMs = 0;
    // Quietest frame seen while calibrating. Using the minimum rather than the mean
    // means a speaker who talks over the calibration window still gets a usable
    // threshold from the gaps between their words.
    let ambient = Infinity;
    let threshold: number | null = null;
    let hasSpoken = false;
    let quietMs = 0;

    return {
        push(level, dtMs) {
            if (threshold === null) {
                ambient = Math.min(ambient, level);
                elapsedCalibrationMs += dtMs;
                if (elapsedCalibrationMs >= calibrateMs) {
                    threshold = Math.max(floor, ambient * thresholdMultiplier);
                }
                return 'continue';
            }

            if (level > threshold) {
                hasSpoken = true;
                quietMs = 0;
                return 'continue';
            }

            // Speech gate: never arm the silence timer before the speaker has said
            // anything, or a pause to gather their thoughts would end the recording.
            if (!hasSpoken) return 'continue';

            quietMs += dtMs;
            return quietMs >= silenceMs ? 'stop' : 'continue';
        },
        get threshold() {
            return threshold;
        },
        get hasSpoken() {
            return hasSpoken;
        },
    };
}
