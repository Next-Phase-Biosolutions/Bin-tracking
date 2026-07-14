import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
    formTitle: string;
    onBack: () => void;
}

export function FormSuccessScreen({ formTitle, onBack }: Props) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="bg-green-50 rounded-full p-6 mb-6">
                <CheckCircle2 className="w-20 h-20 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-[#043F2E] mb-2">Form Submitted!</h2>
            <p className="text-gray-600 text-lg mb-1 font-medium">{formTitle}</p>
            <p className="text-gray-400 text-sm mb-8">
                {dateStr} — {timeStr}
            </p>
            <button
                onClick={onBack}
                className="bg-[#043F2E] hover:bg-[#032f22] text-white px-8 py-3 rounded-xl font-bold text-base transition-colors"
            >
                Back to Forms
            </button>
            <Link
                to="/app/bin"
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline underline-offset-4"
            >
                Go to Scanner
            </Link>
        </div>
    );
}
