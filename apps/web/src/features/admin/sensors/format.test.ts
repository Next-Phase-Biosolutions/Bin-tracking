import { describe, expect, it } from 'vitest';
import { formatAgo, formatMetric } from './format';

describe('formatMetric', () => {
  it('shows a dash for a missing value, never "null" or 0', () => {
    expect(formatMetric(null, '°C', 1)).toBe('—');
    expect(formatMetric(undefined, '%', 0)).toBe('—');
  });

  it('formats with the given decimals and unit', () => {
    expect(formatMetric(24.567, '°C', 1)).toBe('24.6 °C');
    expect(formatMetric(51.2, '%', 0)).toBe('51 %');
    expect(formatMetric(-67, 'dBm', 0)).toBe('-67 dBm');
  });

  it('keeps a real zero', () => {
    expect(formatMetric(0, '°C', 1)).toBe('0.0 °C');
  });

  it('omits the unit when none is given', () => {
    expect(formatMetric(100, '', 0)).toBe('100');
  });
});

describe('formatAgo', () => {
  const NOW = new Date('2026-10-30T12:00:00.000Z');
  const ago = (ms: number) => new Date(NOW.getTime() - ms);

  it('says "never" when there is no timestamp', () => {
    expect(formatAgo(null, NOW)).toBe('never');
  });

  it('reads just now, minutes, hours and days', () => {
    expect(formatAgo(ago(20_000), NOW)).toBe('just now');
    expect(formatAgo(ago(5 * 60_000), NOW)).toBe('5m ago');
    expect(formatAgo(ago(3 * 3_600_000), NOW)).toBe('3h ago');
    expect(formatAgo(ago(2 * 86_400_000), NOW)).toBe('2d ago');
  });

  it('treats a timestamp slightly in the future (device clock skew) as just now', () => {
    expect(formatAgo(new Date(NOW.getTime() + 60_000), NOW)).toBe('just now');
  });
});
