import { MIN_YEAR, MONTH_NAMES, MONTH_SHORT, isFutureMonth } from './calendar';

/**
 * The year switcher and the twelve month pills. Months that have not started yet (after the company's "today") are
 * disabled, and so is the next-year arrow once you are in the current year.
 */
export function MonthBar({
    year,
    month,
    today,
    onYear,
    onMonth,
}: {
    year: number;
    month: number;
    today: string;
    onYear: (delta: -1 | 1) => void;
    onMonth: (month: number) => void;
}) {
    const todayYear = Number(today.slice(0, 4));
    const arrow = 'flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-white text-olive-deep transition-colors hover:border-olive disabled:cursor-not-allowed disabled:opacity-35';
    return (
        <div>
            <div className="flex items-center gap-2">
                <button type="button" className={arrow} aria-label="Previous year" disabled={year <= MIN_YEAR} onClick={() => onYear(-1)}>
                    ◀
                </button>
                <span aria-live="polite" className="min-w-[4.5rem] rounded-lg border border-edge bg-white px-3 py-1 text-center font-display text-base font-extrabold text-olive-deep">
                    {year}
                </span>
                <button type="button" className={arrow} aria-label="Next year" disabled={year >= todayYear} onClick={() => onYear(1)}>
                    ▶
                </button>
            </div>
            <div role="group" aria-label={`Months of ${year}`} className="scroll-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {MONTH_SHORT.map((label, i) => {
                    const m = i + 1;
                    const future = isFutureMonth(year, m, today);
                    const selected = m === month;
                    return (
                        <button
                            key={label}
                            type="button"
                            disabled={future}
                            aria-pressed={selected}
                            aria-label={`${MONTH_NAMES[i]} ${year}`}
                            onClick={() => onMonth(m)}
                            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                                selected ? 'border-olive-deep bg-olive-deep text-bone-light' : 'border-edge bg-white text-olive-deep hover:border-olive'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
