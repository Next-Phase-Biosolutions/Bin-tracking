import { describe, expect, it } from 'vitest';
import { describeSample, nextSelection } from './unknown-ids';

describe('describeSample', () => {
  it('joins temperature, humidity and the raw excerpt', () => {
    expect(describeSample({ lastTempC: 21.5, lastHumidityPct: 71, lastRawExcerpt: '{"fw":"1.2"}' })).toBe(
      '21.5 °C · 71 % · {"fw":"1.2"}',
    );
  });

  it('leaves out what the device did not send', () => {
    expect(describeSample({ lastTempC: null, lastHumidityPct: 40, lastRawExcerpt: null })).toBe('40 %');
  });

  it('says so when there is nothing to show', () => {
    expect(describeSample({ lastTempC: null, lastHumidityPct: null, lastRawExcerpt: null })).toBe('nothing sent');
  });
});

describe('nextSelection', () => {
  it('toggles one id on and off without mutating the previous selection', () => {
    const empty = new Set<string>();
    const one = nextSelection(empty, ['a', 'b'], { toggle: 'a' });
    expect([...one]).toEqual(['a']);
    expect(empty.size).toBe(0);
    expect([...nextSelection(one, ['a', 'b'], { toggle: 'a' })]).toEqual([]);
  });

  it('selects all rows, or clears when every row is already selected', () => {
    const all = nextSelection(new Set(), ['a', 'b'], { all: true });
    expect([...all].sort()).toEqual(['a', 'b']);
    expect(nextSelection(all, ['a', 'b'], { all: true }).size).toBe(0);
  });

  it('drops ids that are no longer listed (added or dismissed meanwhile)', () => {
    const kept = nextSelection(new Set(['a', 'gone']), ['a', 'b'], {});
    expect([...kept]).toEqual(['a']);
  });
});
