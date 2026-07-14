const imgWhoWeAre = "/assets/aboutus/shed.png";

export function WhoWeAre() {
  return (
    <section className="section-dark py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      <div
        className="liquid-blob"
        style={{
          width: 500, height: 400,
          background: 'radial-gradient(circle, rgba(18,205,128,0.07), transparent 65%)',
          top: '20%', right: '-5%',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        {/* Image */}
        <div
          className="w-full lg:w-1/2 shrink-0 rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <img src={imgWhoWeAre} alt="Our farm shed" className="w-full h-auto object-cover" />
        </div>

        {/* Text */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="accent-line" />
            <h2
              className="font-bold text-3xl md:text-5xl text-white leading-tight m-0"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Who We Are
            </h2>
          </div>
          <p
            className="text-base md:text-lg leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.68)', fontFamily: "'Inter', sans-serif" }}
          >
            Next Phase BioSolutions operates on a 500-acre active sheep farm in the Scugog community. We support exactly what happens inside your operation — managing logistics safely, maintaining regulatory compliance, and treating resources with maximum benefit.
          </p>
          <div
            className="glass-card p-5 flex gap-4 items-center"
          >
            <div
              className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-2xl"
              style={{ background: 'rgba(18,205,128,0.12)', border: '1px solid rgba(18,205,128,0.25)' }}
            >
              🌿
            </div>
            <p
              className="text-sm leading-relaxed m-0"
              style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'Inter', sans-serif" }}
            >
              Based in Scugog, Ontario — serving the meat processing industry within 200 km.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhoWeAre;
