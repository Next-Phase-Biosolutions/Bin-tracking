import { useSearchParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Button, Card } from '../../components/ui/primitives';
import { ManagerGate } from '../nfc/ManagerGate';
import { describeAdminError } from '../nfc/errors';
import { CalendarGrid } from './CalendarGrid';
import { DayLog } from './DayLog';
import { MonthBar } from './MonthBar';
import { MIN_YEAR, isFutureMonth, monthOfDate, parseDate, parseMonth, shiftMonth, toDateString, toMonthString } from './calendar';
import { formatLongDate } from './format';

/** The browser's own idea of today, used only until the server tells us today in the COMPANY's timezone. */
function browserToday(): string {
    const d = new Date();
    return toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Attendance Logs: pick a month, then a day, and see who clocked in and out. The month and day live in the URL
 * (?month=2026-01&date=2026-01-14), so a link, a reload and the Back button all land where you were.
 */
export default function AttendanceLogsPage() {
    return (
        <ManagerGate label="Attendance Logs">
            <AttendanceLogs />
        </ManagerGate>
    );
}

function AttendanceLogs() {
    const [params, setParams] = useSearchParams();
    const urlDate = parseDate(params.get('date'));
    const urlMonth = parseMonth(params.get('month'));
    const fallback = parseMonth(browserToday().slice(0, 7))!;
    // A valid date decides the month; otherwise the month parameter; otherwise this month.
    const { year, month } = urlDate ? { year: urlDate.year, month: urlDate.month } : (urlMonth ?? fallback);
    const date = urlDate ? toDateString(urlDate.year, urlDate.month, urlDate.day) : null;

    const monthQuery = trpc.attendance.logsMonth.useQuery({ year, month }, { staleTime: 30_000, retry: false, placeholderData: (previous) => previous });
    const today = monthQuery.data?.today ?? browserToday();
    const dayQuery = trpc.attendance.logsDay.useQuery({ date: date ?? '2000-01-01' }, { enabled: date !== null, staleTime: 15_000, retry: false });

    const counts = new Map((monthQuery.data && monthQuery.data.year === year && monthQuery.data.month === month ? monthQuery.data.days : []).map((d) => [d.date, d.employees]));

    const goMonth = (y: number, m: number) => setParams({ month: toMonthString(y, m) });
    const changeYear = (delta: -1 | 1) => {
        const target = shiftMonth(year, month, delta * 12);
        // Never land on a month that has not started, nor before the first browsable year.
        let { year: ty, month: tm } = target;
        if (ty < MIN_YEAR) return;
        if (isFutureMonth(ty, tm, today)) ({ year: ty, month: tm } = parseMonth(today.slice(0, 7))!);
        goMonth(ty, tm);
    };

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader title="Attendance Logs" subtitle="Who clocked in and out, day by day." icon={<Icon name="clock" width={22} height={22} />} />

            <MonthBar year={year} month={month} today={today} onYear={changeYear} onMonth={(m) => goMonth(year, m)} />

            {monthQuery.isError && (
                <p role="alert" className="mt-4 text-sm text-rust">
                    Could not load this month. {describeAdminError(monthQuery.error)}{' '}
                    <button type="button" className="font-semibold underline" onClick={() => void monthQuery.refetch()}>Try again</button>
                </p>
            )}

            {/* Side by side only on wide screens; below that the calendar sits above the table. min-w-0 on the table column lets a wide table scroll inside its card instead of stretching the page. */}
            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
                <Card className="max-w-md p-4 xl:max-w-none">
                    <CalendarGrid year={year} month={month} counts={counts} today={today} selected={date && monthOfDate(date) === toMonthString(year, month) ? date : null} onSelect={(d) => setParams({ month: toMonthString(year, month), date: d })} />
                    {monthQuery.isFetching && <p role="status" className="mt-2 text-xs text-muted">Loading…</p>}
                </Card>

                <div aria-live="polite" className="min-w-0">
                    {date === null ? (
                        <Card className="border-dashed px-5 py-16 text-center">
                            <p className="font-display font-bold text-olive-deep">Select a date</p>
                            <p className="mt-1 text-sm text-muted">Choose a day on the calendar to see who clocked in and out.</p>
                        </Card>
                    ) : dayQuery.isLoading ? (
                        <Card className="p-5" >
                            <p role="status" className="text-sm text-muted">Loading {formatLongDate(date)}…</p>
                            <div className="mt-4 space-y-3" aria-hidden>
                                {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-edge/40" style={{ width: `${90 - i * 12}%` }} />)}
                            </div>
                        </Card>
                    ) : dayQuery.isError || !dayQuery.data ? (
                        <Card className="px-5 py-10 text-center">
                            <p role="alert" className="text-sm text-rust">Could not load {formatLongDate(date)}. {describeAdminError(dayQuery.error)}</p>
                            <Button className="mt-3" variant="secondary" onClick={() => void dayQuery.refetch()}>Try again</Button>
                        </Card>
                    ) : (
                        <DayLog key={dayQuery.data.date} day={dayQuery.data} />
                    )}
                </div>
            </div>
        </div>
    );
}
