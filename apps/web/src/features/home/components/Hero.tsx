import { LiquidChrome } from '../../../lib/reactbits/LiquidChrome';
import { BlurText } from '../../../lib/reactbits/BlurText';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: '#050d0a' }}>
      {/* LiquidChrome WebGL background */}
      <LiquidChrome
        baseColor={[0.02, 0.14, 0.07]}
        speed={0.16}
        amplitude={0.26}
        frequencyX={2.6}
        frequencyY={2.8}
        interactive
      />

      {/* Dark depth overlay */}
      <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(to bottom, rgba(5,13,10,0.65) 0%, rgba(3,8,5,0.55) 60%, rgba(5,13,10,0.9) 100%)' }} />

      {/* Radial vignette */}
      <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(3,8,5,0.75) 100%)' }} />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center text-center px-5 pt-8 pb-16 max-w-4xl mx-auto">
        {/* Headline with blur animation */}
        <BlurText
          text="Zero Waste Solutions for Abattoirs"
          className="font-bold text-5xl md:text-6xl lg:text-[72px] leading-[1.08] tracking-tight text-white m-0"
          animateBy="words"
          direction="top"
          delay={100}
          stepDuration={0.4}
          // Override p tag with h1 appearance
        />

        {/* Subtext */}
        <p
          className="text-lg md:text-xl leading-relaxed mt-6 mb-10 max-w-xl mx-auto"
          style={{ color: 'rgba(255,255,255,0.72)', fontFamily: "'Inter', sans-serif" }}
        >
          We turn by-products that go to landfill into useful materials. Safe, local, and fully compliant.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button
            className="btn-glow px-8 py-4 text-lg font-bold rounded-full"
          >
            Book a Zero Waste Audit
          </button>
          <a
            href="#solutions"
            className="btn-glass px-8 py-4 text-lg font-semibold rounded-full"
          >
            Learn How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
