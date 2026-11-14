import { MONTH_NAMES, WEEKDAYS, isFutureDate, monthGrid } from './calendar';
import { formatLongDate } from './format';

/**
 * One month as a calendar. Each day shows how many employees clocked in ("5 in"); days with none are plain, future days
 * are disabled, and the chosen day is filled. Every day is a real button, so it works with a keyboard and screen reader.
 */
export function CalendarGrid({
    year,
    month,
    counts,
    today,
    selected,
    onSelect,
}: {
    year: number;
    month: number;
    counts: ReadonlyMap<string, number>;
    today: string;
    selected: string | null;
    onSelect: (date: string) => void;
}) {
    const weeks = monthGrid(year, month);
    return (
        <div role="group" aria-label={`${MONTH_NAMES[month - 1]} ${year}`}>
            <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                    <div key={d} className="pb-1 text-center font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                        {d}
                    </div>
                ))}
                {weeks.flat().map((date, i) => {
                    if (!date) return <div key={`blank-${i}`} aria-hidden className="h-12" />;
                    const n = counts.get(date) ?? 0;
                    const future = isFutureDate(date, today);
                    const isSelected = date === selected;
                    const weekend = i % 7 === 0 || i % 7 === 6;
                    const label = `${formatLongDate(date)}, ${future ? 'in the future' : n === 0 ? 'no one clocked in' : n === 1 ? '1 employee clocked in' : `${n} employees clocked in`}`;
                    return (
                        <button
                            key={date}
                            type="button"
                            disabled={future}
                            aria-pressed={isSelected}
                            aria-label={label}
                            aria-current={date === today ? 'date' : undefined}
                            onClick={() => onSelect(date)}
                            className={`flex h-12 flex-col items-center justify-start rounded-lg pt-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                                isSelected
                                    ? 'bg-olive-deep text-bone-light'
                                    : future
                                      ? 'text-muted/40'
                                      : n === 0
                                        ? `text-muted ${weekend ? 'bg-edge/20' : 'bg-bone-light/50'} hover:bg-edge/40`
                                        : `text-ink ${weekend ? 'bg-edge/20' : 'bg-bone-light/50'} hover:bg-olive/15`
                            } ${date === today && !isSelected ? 'ring-2 ring-rust/50' : ''}`}
                        >
                            {Number(date.slice(8))}
                            {n > 0 && <span className={`text-[0.6rem] font-bold leading-tight ${isSelected ? 'text-bone-light/90' : 'text-live'}`}>{n} in</span>}
                        </button>
                    );
                })}
            </div>
            <p className="mt-3 text-xs text-muted">The number is how many employees clocked in that day. Plain days have no records; future days are disabled.</p>
        </div>
    );
}
