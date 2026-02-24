/** Calculate time remaining until a deadline */
export function calculateCountdown(deadline: Date, now: Date = new Date()): {
    remainingMs: number;
    countdownDisplay: string;
    isOverdue: boolean;
} {
    const remainingMs = deadline.getTime() - now.getTime();
    const isOverdue = remainingMs < 0;

    const absMs = Math.abs(remainingMs);
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));

    const timeStr = `${hours}h ${minutes}m`;
    const countdownDisplay = isOverdue ? `-${timeStr} (OVERDUE)` : timeStr;

    return { remainingMs, countdownDisplay, isOverdue };
}
