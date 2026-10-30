/** The ids with the one at `index` moved one place (-1 up, +1 down). A new array; unchanged at the ends or for a bad index. */
export function moveZone(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
