const imgBadge = "/assets/aboutus/badge.png";
const imgSop = "/assets/aboutus/sop.png";
const imgHelmet = "/assets/aboutus/helmet.png";

const items = [
  { img: imgBadge, label: "Licensed handling and transport" },
  { img: imgSop, label: "SOPs for sanitation and separation" },
  { img: imgHelmet, label: "Staff training and PPE" },
];

export function ComplianceAndSafety() {
  return (
    <section className="section-dark-2 py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      <div
        className="liquid-blob-2"
        style={{
          width: 600, height: 450,
          background: 'radial-gradient(circle, rgba(18,205,128,0.07), transparent 65%)',
          top: '-80px', right: '-100px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Compliance &amp; Safety
          </h2>
          <p
            className="text-base md:text-lg max-w-xl text-center"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Inter', sans-serif" }}
          >
            Every step of our operation meets or exceeds regulatory requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {items.map((item) => (
            <div key={item.label} className="glass-card flex flex-col items-center text-center gap-6 p-8">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'rgba(18,205,128,0.1)',
                  border: '1px solid rgba(18,205,128,0.25)',
                  boxShadow: '0 0 24px rgba(18,205,128,0.12)',
                }}
              >
                <img src={item.img} alt={item.label} className="w-12 h-12 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <p
                className="font-medium text-base text-white leading-snug m-0"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ComplianceAndSafety;
