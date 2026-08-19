import { describe, test, expect } from 'vitest';
import { rms, createSilenceGate, type SilenceGateOptions } from './silence';

const OPTS: SilenceGateOptions = {
    silenceMs: 3500,
    thresholdMultiplier: 2.5,
    floor: 0.01,
    calibrateMs: 300,
};

const FRAME_MS = 100;
const QUIET = 0.001;
const SPEECH = 0.5;

/** Feed `ms` worth of frames at `level`; returns the last verdict seen. */
function feed(gate: ReturnType<typeof createSilenceGate>, level: number, ms: number) {
    let verdict: 'continue' | 'stop' = 'continue';
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
        verdict = gate.push(level, FRAME_MS);
        if (verdict === 'stop') return verdict;
    }
    return verdict;
}

describe('rms', () => {
    test('returns 0 for digital silence', () => {
        expect(rms(new Float32Array(128))).toBe(0);
    });

    test('returns the amplitude of a constant signal', () => {
        expect(rms(new Float32Array(128).fill(0.5))).toBeCloseTo(0.5);
    });

    test('returns 0 for an empty frame rather than NaN', () => {
        expect(rms(new Float32Array(0))).toBe(0);
    });
});

describe('createSilenceGate', () => {
    test('resolves a threshold only after the calibration window', () => {
        const gate = createSilenceGate(OPTS);

        feed(gate, QUIET, 200);
        expect(gate.threshold).toBeNull();

        feed(gate, QUIET, 200);
        expect(gate.threshold).toBe(OPTS.floor);
    });

    test('never stops before the speaker has said anything', () => {
        const gate = createSilenceGate(OPTS);
        feed(gate, QUIET, OPTS.calibrateMs);

        // Ten seconds of silence, far past silenceMs — the speech gate holds it open.
        expect(feed(gate, QUIET, 10_000)).toBe('continue');
        expect(gate.hasSpoken).toBe(false);
    });

    test('stops after silenceMs of quiet once speech has been heard', () => {
        const gate = createSilenceGate(OPTS);
        feed(gate, QUIET, OPTS.calibrateMs);
        feed(gate, SPEECH, 1000);
        expect(gate.hasSpoken).toBe(true);

        // One frame short of the threshold, still recording.
        expect(feed(gate, QUIET, OPTS.silenceMs - FRAME_MS)).toBe('continue');
        expect(gate.push(QUIET, FRAME_MS)).toBe('stop');
    });

    test('resets the silence timer when the speaker resumes', () => {
        const gate = createSilenceGate(OPTS);
        feed(gate, QUIET, OPTS.calibrateMs);
        feed(gate, SPEECH, 500);

        // A long mid-sentence pause, then more speech, then another long pause.
        expect(feed(gate, QUIET, 3000)).toBe('continue');
        expect(feed(gate, SPEECH, 500)).toBe('continue');
        expect(feed(gate, QUIET, 3000)).toBe('continue');

        // Only a full uninterrupted silenceMs ends it.
        expect(feed(gate, QUIET, 1000)).toBe('stop');
    });

    test('raises the threshold in a noisy room so background is not read as speech', () => {
        const gate = createSilenceGate(OPTS);
        feed(gate, 0.1, OPTS.calibrateMs);

        expect(gate.threshold).toBeCloseTo(0.25);

        // Room noise above the floor but below the calibrated threshold.
        feed(gate, 0.2, 5000);
        expect(gate.hasSpoken).toBe(false);
    });

    test('calibrates from the quietest frame, so talking through calibration still works', () => {
        const gate = createSilenceGate(OPTS);

        // Speaking during calibration, but with a gap between words.
        gate.push(SPEECH, FRAME_MS);
        gate.push(QUIET, FRAME_MS);
        gate.push(SPEECH, FRAME_MS);

        // Mean would have put the threshold above speech level; min keeps it usable.
        expect(gate.threshold).toBe(OPTS.floor);
        feed(gate, SPEECH, 500);
        expect(gate.hasSpoken).toBe(true);
    });
});
