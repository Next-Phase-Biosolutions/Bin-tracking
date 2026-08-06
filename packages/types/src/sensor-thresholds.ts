// PLACEHOLDER thresholds — confirm real values with vendor. Sanity-checked
// against backfilled demo data (Action Item 3) so the OK/WARN/ALERT
// distribution isn't one solid color throughout the demo.
export const SENSOR_THRESHOLDS = {
    temp: { warnLow: 2, warnHigh: 8, alertLow: 0, alertHigh: 12 },
    humidity: { warnLow: 30, warnHigh: 70, alertLow: 20, alertHigh: 85 },
    nh3: { warnPpm: 25, alertPpm: 50 },
} as const;

export type ThresholdStatus = 'OK' | 'WARN' | 'ALERT' | 'UNKNOWN';

type ComputedStatus = 'OK' | 'WARN' | 'ALERT';

function statusFor(value: number, warnLow: number, warnHigh: number, alertLow: number, alertHigh: number): ComputedStatus {
    if (value < alertLow || value > alertHigh) return 'ALERT';
    if (value < warnLow || value > warnHigh) return 'WARN';
    return 'OK';
}

const RANK: Record<ComputedStatus, number> = { OK: 0, WARN: 1, ALERT: 2 };

/**
 * Simplified for the demo: returns a single overall status rather than a
 * per-metric breakdown ({ overall, byMetric } is post-demo scope). Evaluates
 * temp/humidity/nh3 independently against SENSOR_THRESHOLDS and returns the
 * worst of the three (ALERT > WARN > OK). The six air-quality metrics have
 * no thresholds yet and are not part of this computation — they're captured
 * and displayed (Action Item 8) but not alert-gated.
 */
export function computeThresholdStatus(reading: {
    tempC: number;
    humidityPct: number;
    nh3Ppm: number | null;
    tvoc?: number | null;
    eco2Ppm?: number | null;
    aqhiPlus?: number | null;
    ozonePpb?: number | null;
    pressure?: number | null;
    pm25?: number | null;
}): ThresholdStatus {
    const statuses: ComputedStatus[] = [
        statusFor(
            reading.tempC,
            SENSOR_THRESHOLDS.temp.warnLow,
            SENSOR_THRESHOLDS.temp.warnHigh,
            SENSOR_THRESHOLDS.temp.alertLow,
            SENSOR_THRESHOLDS.temp.alertHigh,
        ),
        statusFor(
            reading.humidityPct,
            SENSOR_THRESHOLDS.humidity.warnLow,
            SENSOR_THRESHOLDS.humidity.warnHigh,
            SENSOR_THRESHOLDS.humidity.alertLow,
            SENSOR_THRESHOLDS.humidity.alertHigh,
        ),
    ];
    if (reading.nh3Ppm !== null) {
        if (reading.nh3Ppm > SENSOR_THRESHOLDS.nh3.alertPpm) statuses.push('ALERT');
        else if (reading.nh3Ppm > SENSOR_THRESHOLDS.nh3.warnPpm) statuses.push('WARN');
        else statuses.push('OK');
    }

    return statuses.reduce((worst, status) => (RANK[status] > RANK[worst] ? status : worst), 'OK' as ComputedStatus);
}
