import { useEffect, useState } from 'react';

interface CountdownTimerProps {
    deadline: Date | string;
    isOverdue?: boolean;
}

export function CountdownTimer({ deadline }: CountdownTimerProps) {
    const [display, setDisplay] = useState<string>('');
    const [overdue, setOverdue] = useState(false);

    useEffect(() => {
        const targetMs = new Date(deadline).getTime();

        const tick = () => {
            const diffMs = targetMs - Date.now();

            if (diffMs <= 0) {
                // Clamped at zero — show OVERDUE badge instead of negative count
                setOverdue(true);
                setDisplay('00:00:00');
            } else {
                setOverdue(false);
                const h = Math.floor(diffMs / 3_600_000);
                const m = Math.floor((diffMs % 3_600_000) / 60_000);
                const s = Math.floor((diffMs % 60_000) / 1000);
                setDisplay(
                    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                );
            }
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [deadline]);

    if (overdue) {
        return (
            <span className="inline-flex items-center gap-1">
                <span className="font-mono px-2 py-1 rounded inline-block text-center text-red-700 font-bold bg-red-50 ring-1 ring-inset ring-red-500/30 animate-pulse">
                    OVERDUE
                </span>
            </span>
        );
    }

    const urgent = display.startsWith('00:');
    return (
        <span
            className={`font-mono px-2 py-1 rounded inline-block min-w-[90px] text-center font-semibold
                ${urgent ? 'text-orange-600 bg-orange-50 ring-1 ring-inset ring-orange-400/30' : 'text-gray-900 bg-gray-100'}`}
        >
            {display}
        </span>
    );
}
