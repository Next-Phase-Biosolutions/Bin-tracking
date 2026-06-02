import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
    title: string;
    instructions?: string | null;
    children: ReactNode;
    /** Show full-bleed green header (worker fill view) */
    showTitleBar?: boolean;
}

export function FormFillLayout({
    title,
    instructions,
    children,
    showTitleBar = true,
}: Props) {
    return (
        <div className="flex flex-col bg-[#F5F8F2]">
            {showTitleBar && (
                <div className="bg-[#043F2E] px-4 py-5 text-center shadow-md">
                    <h1 className="text-lg font-bold leading-snug text-white sm:text-xl">{title}</h1>
                </div>
            )}

            <div className="flex flex-col gap-5 px-3 py-4 sm:px-4">
                {instructions?.trim() && (
                    <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-[#FBF5E6] p-4 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <Info className="h-4 w-4 text-amber-800" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                                Monitoring Procedures
                            </p>
                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-amber-950">
                                {instructions}
                            </p>
                        </div>
                    </div>
                )}

                {children}
            </div>
        </div>
    );
}
