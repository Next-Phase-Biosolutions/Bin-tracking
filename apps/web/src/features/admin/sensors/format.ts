/** "24.6 °C", "51 %", "-67 dBm"; a dash (never "null" or a fake 0) when there is no value. */
export function formatMetric(value: number | null | undefined, unit: string, decimals: number): string {
  if (value === null || value === undefined) return '—';
  const text = value.toFixed(decimals);
  return unit ? `${text} ${unit}` : text;
}

/** Relative time for tables: "just now", "5m ago", "3h ago", "2d ago", or "never". Future (clock-skewed) times read as just now. */
export function formatAgo(date: Date | null, now: Date): string {
  if (date === null) return 'never';
  const elapsedMs = now.getTime() - date.getTime();
  if (elapsedMs < 60_000) return 'just now';
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
