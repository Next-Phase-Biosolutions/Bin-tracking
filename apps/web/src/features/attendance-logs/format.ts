/** Formatting for the Attendance Logs page. Times are shown in the COMPANY's timezone, whatever the viewer's browser is set to. */

/** 498 -> "8h 18m", 480 -> "8h 00m", 45 -> "0h 45m". */
export function formatMinutes(totalMinutes: number): string {
    const safe = Math.max(0, Math.round(totalMinutes));
    return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}m`;
}

/** 45 -> "45m", 90 -> "1h 30m", 120 -> "2h". Used for breaks. */
export function formatShort(totalMinutes: number): string {
    const safe = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "8:55 AM" in the given IANA timezone. An unknown timezone falls back to UTC instead of throwing. */
export function formatClock(date: Date, timeZone: string): string {
    const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    try {
        return new Intl.DateTimeFormat([], { ...options, timeZone }).format(date);
    } catch {
        return new Intl.DateTimeFormat([], { ...options, timeZone: 'UTC' }).format(date);
    }
}

/** 'YYYY-MM-DD' -> "Wednesday, January 14, 2026". The date is calendar text, so no timezone shift can move it. */
export function formatLongDate(date: string): string {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/** The "+1 day" marker for a clock-out that falls after midnight. Empty for the same day. */
export const dayOffsetLabel = (offset: number): string => (offset > 0 ? `+${offset} day${offset === 1 ? '' : 's'}` : '');
