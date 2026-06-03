const results = [
  { stat: "72", unit: "Tonnes", desc: "diverted from landfill in the last 6 months" },
  { stat: "35%", unit: "Cost Reduction", desc: "average at pilot sites on disposal spend" },
  { stat: "48hrs", unit: "Onboarding", desc: "from first contact to scheduled first pickup" },
];

export function ProvenResults() {
  return (
    <section className="section-dark py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      {/* Strong glow blob in centre */}
      <div
        className="liquid-blob"
        style={{
          width: 700, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.09), transparent 65%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl tracking-tight text-white"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Proven Results
          </h2>
          <p
            className="text-base md:text-lg max-w-lg"
            style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}
          >
            Real numbers from real operations — tracked, verified, reported.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {results.map((r) => (
            <div
              key={r.stat}
              className="glass-card p-8 flex flex-col gap-3 text-center"
            >
              {/* Big number */}
              <p
                className="font-bold text-6xl md:text-7xl m-0 leading-none"
                style={{ color: '#12cd80', fontFamily: "'Montserrat', sans-serif", textShadow: '0 0 30px rgba(18,205,128,0.4)' }}
              >
                {r.stat}
              </p>
              <p
                className="font-semibold text-sm tracking-widest uppercase m-0"
                style={{ color: 'rgba(255,255,255,0.9)', fontFamily: "'Inter', sans-serif" }}
              >
                {r.unit}
              </p>
              <div className="w-8 h-px mx-auto" style={{ background: 'rgba(18,205,128,0.3)' }} />
              <p
                className="text-sm leading-relaxed m-0"
                style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Open Sans', sans-serif" }}
              >
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
