const pillars = [
  {
    icon: "📍",
    title: "Local & Nimble",
    body: "We are locally tied to farms and communities here, and actively adapt our solutions to match your volume fluctuations — no rigid contracts.",
  },
  {
    icon: "🔍",
    title: "Transparent",
    body: "Our process is open-door. You see exactly where your materials are going, with full tracking and monthly reports you can use for audits.",
  },
  {
    icon: "⚙️",
    title: "Practical & Reliable",
    body: "100% dependable. We handle the heavy lifting — clean collection, compliant transport, consistent processing — so your team doesn't have to.",
  },
];

export function HowWereDifferent() {
  return (
    <section className="section-dark py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      <div
        className="liquid-blob"
        style={{
          width: 600, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.07), transparent 65%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            How We're Different
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {pillars.map((p) => (
            <div key={p.title} className="glass-card p-8 flex flex-col gap-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: 'rgba(18,205,128,0.1)',
                  border: '1px solid rgba(18,205,128,0.2)',
                  boxShadow: '0 0 20px rgba(18,205,128,0.1)',
                }}
              >
                {p.icon}
              </div>
              <div className="w-8 h-px" style={{ background: 'rgba(18,205,128,0.35)' }} />
              <h3
                className="font-bold text-xl text-white m-0"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {p.title}
              </h3>
              <p
                className="text-sm leading-relaxed m-0"
                style={{ color: 'rgba(255,255,255,0.62)', fontFamily: "'Inter', sans-serif" }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowWereDifferent;
