const imgCtaOverlay = "/assets/imgCtaBg.png";

export function CTA() {
  return (
    <section className="relative min-h-96 lg:min-h-130 overflow-hidden flex items-center justify-center py-20 px-5">
      {/* Background image */}
      <img src={imgCtaOverlay} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

      {/* Dark overlay */}
      <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to bottom, rgba(5,13,10,0.7), rgba(3,8,5,0.85))' }} />

      {/* Glow blob */}
      <div
        className="liquid-blob z-0"
        style={{
          width: 600, height: 400,
          background: 'radial-gradient(circle, rgba(18,205,128,0.12), transparent 65%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Glass content panel */}
      <div
        className="relative z-10 glass-card flex flex-col items-center gap-8 px-8 py-12 text-center max-w-2xl mx-auto w-full"
      >
        <div className="accent-line mx-auto" />
        <h2
          className="font-bold text-3xl md:text-5xl lg:text-6xl leading-tight tracking-tight text-white m-0"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Ready to Reduce<br />Waste and Costs?
        </h2>
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'Inter', sans-serif" }}
        >
          Book a free plant audit. We review your by-product streams and show how much you can divert from landfill — at no cost to you.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="btn-glow px-8 py-4 text-lg font-bold rounded-full">
            Book a Zero Waste Audit
          </button>
          <a href="/about" className="btn-glass px-8 py-4 text-lg font-semibold rounded-full">
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
