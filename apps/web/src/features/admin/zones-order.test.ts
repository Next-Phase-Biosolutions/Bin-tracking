import { describe, expect, it } from 'vitest';
import { moveZone } from './zones-order';

describe('moveZone', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves a zone up or down one place', () => {
    expect(moveZone(ids, 2, -1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveZone(ids, 1, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('leaves the order alone at either end', () => {
    expect(moveZone(ids, 0, -1)).toEqual(ids);
    expect(moveZone(ids, 3, 1)).toEqual(ids);
  });

  it('ignores an index that is not in the list', () => {
    expect(moveZone(ids, 9, -1)).toEqual(ids);
    expect(moveZone(ids, -1, 1)).toEqual(ids);
  });

  it('returns a new array and never mutates the input', () => {
    const input = ['a', 'b'];
    const out = moveZone(input, 0, 1);
    expect(out).not.toBe(input);
    expect(input).toEqual(['a', 'b']);
    expect(out).toEqual(['b', 'a']);
  });
});
