const partners = [
  { img: "/assets/imgPartner1.png", alt: "EcoWaste" },
  { img: "/assets/imgPartner2.png", alt: "GreenEnergy" },
  { img: "/assets/imgPartner3.png", alt: "PureSolutions" },
  { img: "/assets/imgPartner4.png", alt: "Partner 4" },
];

export function Partners() {
  return (
    <section className="section-dark-2 py-14 px-5 md:py-20 md:px-16 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-10">
        <p
          className="text-xs font-semibold tracking-widest uppercase text-center"
          style={{ color: 'rgba(255,255,255,0.35)', fontFamily: "'Inter', sans-serif" }}
        >
          Supported By
        </p>

        {/* Partner logos in a glass strip */}
        <div
          className="w-full rounded-2xl px-8 py-6 flex flex-wrap justify-center items-center gap-10 md:gap-16"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {partners.map((p, i) => (
            <img
              key={i}
              src={p.img}
              alt={p.alt}
              className="h-10 md:h-12 w-auto object-contain opacity-50 hover:opacity-80 transition-opacity duration-300"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
