const imgHeroBg = "/assets/solutions/solHero.png";

export function SolutionsHero() {
  return (
    <section className="relative w-full min-h-125 lg:min-h-200 overflow-hidden" style={{ background: '#030a06' }}>
      <img src={imgHeroBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(3,10,6,0.55) 0%, rgba(5,13,10,0.75) 65%, rgba(5,13,10,1) 100%)' }}
      />
      <div
        className="liquid-blob"
        style={{
          width: 700, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.1), transparent 65%)',
          top: '20%', left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center min-h-125 lg:min-h-200 justify-center text-center px-5">
        <div className="flex flex-col items-center gap-6 max-w-3xl">
          <div className="glass-pill px-5 py-2 text-xs font-semibold tracking-widest uppercase" style={{ color: '#12cd80' }}>
            Zero Waste Program
          </div>
          <h1
            className="font-bold text-4xl md:text-5xl lg:text-7xl text-white text-center leading-tight tracking-tight m-0"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            The Zero Waste Program for Abattoirs
          </h1>
          <p
            className="text-lg md:text-xl text-center leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.68)', fontFamily: "'Inter', sans-serif" }}
          >
            A simple, closed-loop system that turns your by-products into value while reducing risk and landfill waste.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="btn-glow px-8 py-4 text-lg font-bold rounded-full">
              Request a Zero Waste Audit
            </button>
            <a href="#what-we-handle" className="btn-glass px-8 py-4 text-lg font-semibold rounded-full">
              See What We Handle
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SolutionsHero;
