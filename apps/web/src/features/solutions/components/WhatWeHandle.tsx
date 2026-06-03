const imgGroup31 = "/assets/solutions/jacket.png";
const imgGroup1 = "/assets/solutions/meat.png";
const imgCuts = "/assets/solutions/cuts.png";
const imgDoc = "/assets/doc.png";

const materials = [
  { icon: imgGroup31, label: "Hides and Skins", sub: "Leather pathways" },
  { icon: imgGroup1, label: "Fats and Suet", sub: "Tallow & bio-oils" },
  { icon: imgCuts, label: "Select Off-Cuts", sub: "Collagen inputs" },
  { icon: imgDoc, label: "Other Materials", sub: "Discuss with our team" },
];

export function WhatWeHandle() {
  return (
    <section id="what-we-handle" className="section-dark-2 py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      <div
        className="liquid-blob"
        style={{
          width: 600, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.07), transparent 65%)',
          top: '50%', right: '-10%',
          transform: 'translateY(-50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white text-center leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            What We Handle
          </h2>
          <p
            className="text-base md:text-lg max-w-lg text-center"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Inter', sans-serif" }}
          >
            We accept a wide range of animal by-products and ensure every material finds a productive second life.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 w-full">
          {materials.map((m) => (
            <div
              key={m.label}
              className="glass-card flex flex-col items-center gap-5 p-6 text-center"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(18,205,128,0.1)',
                  border: '1px solid rgba(18,205,128,0.2)',
                  boxShadow: '0 0 24px rgba(18,205,128,0.1)',
                }}
              >
                <img src={m.icon} alt={m.label} className="w-10 h-10 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm text-white m-0" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {m.label}
                </p>
                <p className="text-xs mt-1 m-0" style={{ color: '#12cd80', fontFamily: "'Inter', sans-serif" }}>
                  {m.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhatWeHandle;
