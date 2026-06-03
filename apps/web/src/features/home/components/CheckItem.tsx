import { Check } from 'lucide-react';

export function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: 'rgba(18,205,128,0.12)',
          border: '1px solid rgba(18,205,128,0.3)',
          boxShadow: '0 0 12px rgba(18,205,128,0.15)',
        }}
      >
        <Check className="w-3.5 h-3.5" style={{ color: '#12cd80' }} strokeWidth={3} />
      </div>
      <p
        className="text-base md:text-[18px] leading-relaxed m-0"
        style={{ color: 'rgba(255,255,255,0.8)', fontFamily: "'Open Sans', sans-serif" }}
      >
        {text}
      </p>
    </div>
  );
}
