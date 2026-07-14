const imgHeroBg = "/assets/aboutus/about-hero.png";

export function AboutHero() {
  return (
    <section className="relative w-full min-h-125 lg:min-h-175 overflow-hidden" style={{ background: '#030a06' }}>
      <img
        src={imgHeroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(3,10,6,0.5) 0%, rgba(5,13,10,0.7) 60%, rgba(5,13,10,1) 100%)' }}
      />
      <div
        className="liquid-blob"
        style={{
          width: 700, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.1), transparent 65%)',
          top: '30%', left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-125 lg:min-h-175 text-center px-5">
        <div className="flex flex-col items-center gap-6 max-w-3xl">
          <div className="glass-pill px-5 py-2 text-xs font-semibold tracking-widest uppercase" style={{ color: '#12cd80' }}>
            Our Story
          </div>
          <h1
            className="font-bold text-4xl md:text-5xl lg:text-7xl text-white leading-tight tracking-tight m-0"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            About Next Phase BioSolutions
          </h1>
          <p
            className="text-lg md:text-xl leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'Inter', sans-serif" }}
          >
            500 acres, one mission — turning the meat industry's waste problem into a circular economy opportunity.
          </p>
        </div>
      </div>
    </section>
  );
}

export default AboutHero;
