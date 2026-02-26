import { useEffect, useState } from 'react';

interface CountdownTimerProps {
    deadline: Date | string;
    isOverdue?: boolean;
}

export function CountdownTimer({ deadline, isOverdue = false }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isNegative, setIsNegative] = useState(isOverdue);

    useEffect(() => {
        const targetDate = new Date(deadline).getTime();

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const difference = targetDate - now;

            if (difference < 0) {
                setIsNegative(true);
            } else {
                setIsNegative(false);
            }

            const absDifference = Math.abs(difference);

            const hours = Math.floor(absDifference / (1000 * 60 * 60));
            const minutes = Math.floor((absDifference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((absDifference % (1000 * 60)) / 1000);

            const display = `${isNegative ? '-' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            setTimeLeft(display);
        };

        // Initial calculation
        calculateTimeLeft();

        // Update every second
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [deadline, isNegative]);

    const colorClass = isNegative
        ? 'text-red-600 font-bold'
        : 'text-gray-900 font-medium';

    const bgClass = isNegative ? 'bg-red-50' : 'bg-gray-100';

    return (
        <span className={`font-mono px-2 py-1 rounded inline-block min-w-[90px] text-center ${colorClass} ${bgClass}`}>
            {timeLeft}
        </span>
    );
}
