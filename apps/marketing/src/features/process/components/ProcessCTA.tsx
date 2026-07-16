export function ProcessCTA() {
  return (
    <section className="section-dark py-20 px-5 lg:py-28 lg:px-16 overflow-hidden">
      <div
        className="liquid-blob"
        style={{
          width: 700, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.1), transparent 65%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
        {/* Left image */}
        <div
          className="hidden md:block w-64 aspect-4/3 rounded-2xl overflow-hidden shrink-0"
          style={{ border: '1px solid rgba(18,205,128,0.2)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
        >
          <img src="/assets/process/soil.png" alt="Soil and plants" className="w-full h-full object-cover" />
        </div>

        {/* Center content */}
        <div className="flex flex-col items-center text-center gap-8 max-w-lg mx-auto flex-1">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white leading-tight m-0"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Ready to Start Your Zero-Waste Program?
          </h2>
          <p
            className="text-base md:text-lg leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.62)', fontFamily: "'Inter', sans-serif" }}
          >
            Our team will audit your operation, define a clear plan, and have you running in 48 hours.
          </p>
          <button className="btn-glow px-8 py-4 text-lg font-bold rounded-full">
            Book a Zero Waste Audit
          </button>
        </div>

        {/* Right image */}
        <div
          className="hidden md:block w-64 aspect-3/4 rounded-2xl overflow-hidden shrink-0"
          style={{ border: '1px solid rgba(18,205,128,0.2)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
        >
          <img src="/assets/process/paper.png" alt="Working hands" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>
  );
}
