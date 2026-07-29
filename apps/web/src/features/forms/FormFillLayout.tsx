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
        <div className="flex flex-col bg-canvas">
            {showTitleBar && (
                <div className="bg-olive-deep px-4 py-5 text-center shadow-md">
                    <h1 className="text-lg font-bold leading-snug text-bone-light sm:text-xl">{title}</h1>
                </div>
            )}

            <div className="flex flex-col gap-5 px-3 py-4 sm:px-4">
                {instructions?.trim() && (
                    <div className="flex gap-3 rounded-xl border border-edge bg-bone-light p-4 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust/10">
                            <Info className="h-4 w-4 text-rust" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-olive-deep">
                                Monitoring Procedures
                            </p>
                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
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
