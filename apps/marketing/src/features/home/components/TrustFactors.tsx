const imgTrustLocal = "/assets/location.png";
const imgTrustLicensed = "/assets/trust.png";
const imgTrustTrace = "/assets/doc.png";
const imgTrustSetup = "/assets/bolt.png";
const imgTrustReduce = "/assets/recycle.png";

const trustItems = [
  { icon: imgTrustLocal, label: "Local Coverage", sub: "Up to 200 km" },
  { icon: imgTrustLicensed, label: "Licensed Handling", sub: "Fully compliant" },
  { icon: imgTrustTrace, label: "Traceability", sub: "Full reporting" },
  { icon: imgTrustSetup, label: "Fast Setup", sub: "48 hr onboarding" },
  { icon: imgTrustReduce, label: "Reduce Costs", sub: "35% avg savings" },
];

export function TrustFactors() {
  return (
    <section className="section-dark-2 py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      {/* Background blobs */}
      <div
        className="liquid-blob"
        style={{
          width: 600, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.07), transparent 65%)',
          top: -100, left: '30%',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line" />
          <h2
            className="font-bold text-3xl md:text-5xl tracking-tight text-white"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Why Trust Us
          </h2>
        </div>

        <div className="flex flex-wrap gap-5 md:gap-6 items-stretch justify-center">
          {trustItems.map((item) => (
            <div
              key={item.label}
              className="glass-card flex flex-col items-center gap-4 p-6 w-44 md:w-52 text-center"
            >
              {/* Icon ring */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(18,205,128,0.1)',
                  border: '1px solid rgba(18,205,128,0.25)',
                  boxShadow: '0 0 20px rgba(18,205,128,0.12)',
                }}
              >
                <img src={item.icon} alt={item.label} className="w-8 h-8 object-contain" style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(100deg)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm text-white m-0" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {item.label}
                </p>
                <p className="text-xs mt-1 m-0" style={{ color: '#12cd80', fontFamily: "'Inter', sans-serif" }}>
                  {item.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
