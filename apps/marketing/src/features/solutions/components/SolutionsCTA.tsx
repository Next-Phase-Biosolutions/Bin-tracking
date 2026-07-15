const imgCtaBg = "/assets/imgCtaBg.png";

export function SolutionsCTA() {
  return (
    <section className="relative min-h-96 lg:min-h-130 overflow-hidden flex items-center justify-center py-20 px-5">
      <img src={imgCtaBg} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to bottom, rgba(5,13,10,0.72), rgba(3,8,5,0.9))' }} />
      <div
        className="liquid-blob z-0"
        style={{
          width: 600, height: 400,
          background: 'radial-gradient(circle, rgba(18,205,128,0.12), transparent 65%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 glass-card flex flex-col items-center gap-8 px-8 py-12 text-center max-w-2xl mx-auto w-full">
        <div className="accent-line mx-auto" />
        <h2
          className="font-bold text-3xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight m-0"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Start Your Zero Waste Program
        </h2>
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'Inter', sans-serif" }}
        >
          Get a simple audit of your plant. We review your by-product streams and show how much waste you can divert from landfill.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="btn-glow px-8 py-4 text-lg font-bold rounded-full">
            Contact Our Team
          </button>
          <a href="/process" className="btn-glass px-8 py-4 text-lg font-semibold rounded-full">
            See the Process
          </a>
        </div>
      </div>
    </section>
  );
}

export default SolutionsCTA;
