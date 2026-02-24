import { Check } from 'lucide-react';

/* ─────────────────────────────────────────
   CHECK LIST ITEM
───────────────────────────────────────── */
export function CheckItem({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-3 md:gap-4 md:items-center">
            <div className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0 bg-[#2a6f2b] rounded-full flex justify-center items-center mt-1 md:mt-0">
                <Check className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] text-white" strokeWidth={3} />
            </div>
            <p
                className="font-normal text-base md:text-[20px] leading-relaxed text-black m-0"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
                {text}
            </p>
        </div>
    );
}
