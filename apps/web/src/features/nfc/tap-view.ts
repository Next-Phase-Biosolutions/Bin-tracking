/** What the /app/tap page renders for each outcome. Pure, so it is unit-tested without a DOM. */

export type TapResult =
    | { status: 'CHECK_IN'; at: Date; employeeName: string; debounced: boolean }
    | { status: 'CHECK_OUT'; at: Date; employeeName: string; durationMin: number; debounced: boolean }
    | { status: 'ALREADY_CHECKED_IN'; at: Date; since: Date; employeeName: string; debounced: boolean }
    | { status: 'NOT_CHECKED_IN'; at: Date; employeeName: string; debounced: boolean }
    | { status: 'REGISTRATION_COMPLETE'; at: Date; employeeName: string; debounced: boolean };

export type Tone = 'in' | 'out' | 'registered' | 'warn';

export interface TapView {
    tone: Tone;
    icon: string;
    title: string;
    detail?: string;
}

export const formatTime = (d: Date): string => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function formatDuration(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** A double-tap echo renders exactly like the original result, so the employee sees no difference. */
export function toTapView(r: TapResult): TapView {
    switch (r.status) {
        case 'REGISTRATION_COMPLETE':
            return { tone: 'registered', icon: '✅', title: 'Phone registered!', detail: 'You can now tap this card to clock in and out.' };
        case 'CHECK_IN':
            return { tone: 'in', icon: '👋', title: `Checked in at ${formatTime(r.at)}`, detail: r.employeeName };
        case 'CHECK_OUT':
            return {
                tone: 'out',
                icon: '🏁',
                title: `Checked out at ${formatTime(r.at)}`,
                detail: `Worked ${formatDuration(r.durationMin)} · ${r.employeeName}`,
            };
        case 'ALREADY_CHECKED_IN':
            return { tone: 'warn', icon: '⚠️', title: 'Already checked in', detail: `You’ve been checked in since ${formatTime(r.since)}. Tap the OUT card to check out.` };
        case 'NOT_CHECKED_IN':
            return { tone: 'warn', icon: '⚠️', title: 'Not checked in', detail: 'You’re not checked in right now. Tap the IN card first.' };
    }
}
