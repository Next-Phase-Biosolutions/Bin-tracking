export function ProcessHero() {
  return (
    <section className="section-dark py-20 px-5 lg:py-28 lg:px-16 overflow-hidden">
      <div
        className="liquid-blob"
        style={{
          width: 600, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.09), transparent 65%)',
          top: '10%', right: '-5%',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <div className="flex flex-col gap-7">
          <div className="glass-pill px-4 py-2 text-xs font-semibold tracking-widest uppercase w-fit" style={{ color: '#12cd80' }}>
            How It Works
          </div>
          <h1
            className="font-bold text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight m-0"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Simple 5-Step Process
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'Inter', sans-serif" }}
          >
            We make landfill diversion simple. Our five-step process helps your plant turn by-products into value — safely, compliantly, and with minimal disruption.
          </p>
          <div className="flex gap-4">
            <button className="btn-glow px-8 py-4 text-base font-bold rounded-full">
              Get in Touch
            </button>
            <a href="#steps" className="btn-glass px-8 py-4 text-base font-semibold rounded-full">
              See the Steps
            </a>
          </div>
        </div>

        {/* Image */}
        <div
          className="rounded-2xl overflow-hidden h-100 lg:h-125 relative"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <img src="/assets/process/truck.png" alt="Loading docks" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(18,205,128,0.06) 0%, transparent 60%, rgba(0,0,0,0.2) 100%)' }}
          />
        </div>
      </div>
    </section>
  );
}
