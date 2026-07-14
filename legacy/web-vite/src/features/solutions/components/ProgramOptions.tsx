import { Check } from 'lucide-react';

interface PricingCardProps {
  title: string;
  price: string;
  yearly: string;
  features: string[];
  highlight?: boolean;
}

function PricingCard({ title, price, yearly, features, highlight }: PricingCardProps) {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl p-7 lg:p-8 relative overflow-hidden"
      style={{
        background: highlight
          ? 'rgba(18,205,128,0.12)'
          : 'rgba(6,40,28,0.35)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: highlight
          ? '1px solid rgba(18,205,128,0.45)'
          : '1px solid rgba(18,205,128,0.14)',
        boxShadow: highlight
          ? '0 8px 40px rgba(0,0,0,0.4), 0 0 40px rgba(18,205,128,0.12)'
          : '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {highlight && (
        <div
          className="absolute top-4 right-4 glass-pill px-3 py-1 text-xs font-bold tracking-widest uppercase"
          style={{ color: '#12cd80' }}
        >
          Popular
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <p
          className="font-bold text-xl text-white m-0"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {title}
        </p>
        <div className="flex items-baseline gap-1">
          <span
            className="font-bold text-6xl leading-none"
            style={{ color: highlight ? '#12cd80' : 'rgba(255,255,255,0.9)', fontFamily: "'Montserrat', sans-serif" }}
          >
            {price}
          </span>
          <span className="text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>/mo</span>
        </div>
        <p className="text-sm m-0" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: "'Open Sans', sans-serif" }}>
          {yearly}
        </p>
      </div>

      <div className="h-px w-full mb-6" style={{ background: 'rgba(18,205,128,0.15)' }} />

      {/* Features */}
      <div className="flex flex-col gap-3 flex-1 mb-8">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#12cd80' }} strokeWidth={2.5} />
            <span
              className="text-sm leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.72)', fontFamily: "'Open Sans', sans-serif" }}
            >
              {f}
            </span>
          </div>
        ))}
      </div>

      <button
        className="w-full py-3.5 px-6 rounded-full text-sm font-bold transition-all duration-200 cursor-pointer border-none"
        style={
          highlight
            ? { background: '#12cd80', color: '#01140e', boxShadow: '0 0 20px rgba(18,205,128,0.35)' }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }
        }
      >
        Get Started
      </button>
    </div>
  );
}

export function ProgramOptions() {
  return (
    <section className="section-dark-2 py-20 px-5 lg:py-28 lg:px-16 overflow-hidden">
      <div
        className="liquid-blob"
        style={{
          width: 700, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.08), transparent 65%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white text-center leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Program Options
          </h2>
          <p
            className="text-base md:text-lg max-w-lg text-center"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Inter', sans-serif" }}
          >
            Flexible plans designed around how your operation runs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <PricingCard
            title="Basic"
            price="$19"
            yearly="or $199 yearly"
            features={['Collection service', 'Landfill diversion report']}
          />
          <PricingCard
            title="Standard"
            price="$29"
            yearly="or $299 yearly"
            features={['Collection', 'Processing', 'Monthly reports', 'Compliance toolkit']}
            highlight
          />
          <PricingCard
            title="Custom"
            price="$49"
            yearly="or $499 yearly"
            features={['Revenue share options', 'Custom sorting', 'On-site SOP training']}
          />
        </div>
      </div>
    </section>
  );
}

export default ProgramOptions;
