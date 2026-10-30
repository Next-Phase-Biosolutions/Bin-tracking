interface SampleFields {
  lastTempC: number | null;
  lastHumidityPct: number | null;
  lastRawExcerpt: string | null;
}

/** One line telling an admin what an unregistered device last sent, so test devices can be told apart. */
export function describeSample(row: SampleFields): string {
  const parts = [
    row.lastTempC === null ? null : `${row.lastTempC} °C`,
    row.lastHumidityPct === null ? null : `${row.lastHumidityPct} %`,
    row.lastRawExcerpt,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? 'nothing sent' : parts.join(' · ');
}

/**
 * The checkbox selection after a click. Always intersected with the ids still
 * listed, so a row that was added or dismissed meanwhile cannot stay selected
 * and be acted on again.
 */
export function nextSelection(
  current: ReadonlySet<string>,
  listedIds: readonly string[],
  change: { toggle?: string; all?: boolean },
): Set<string> {
  const listed = new Set(listedIds);
  const next = new Set([...current].filter((id) => listed.has(id)));
  if (change.toggle !== undefined && listed.has(change.toggle)) {
    if (next.has(change.toggle)) next.delete(change.toggle);
    else next.add(change.toggle);
  }
  if (change.all) {
    if (next.size === listed.size) next.clear();
    else for (const id of listed) next.add(id);
  }
  return next;
}
