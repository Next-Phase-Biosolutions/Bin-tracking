const imgWhyWeExist = "/assets/aboutus/sheep.png";

export function WhyWeExist() {
  return (
    <section className="section-dark-2 py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      <div
        className="liquid-blob-2"
        style={{
          width: 500, height: 450,
          background: 'radial-gradient(circle, rgba(4,63,46,0.3), transparent 65%)',
          top: '10%', left: '-8%',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
        {/* Text */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="accent-line" />
            <h2
              className="font-bold text-3xl md:text-5xl text-white leading-tight m-0"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Why We Exist
            </h2>
          </div>
          <p
            className="text-base md:text-lg leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.68)', fontFamily: "'Inter', sans-serif" }}
          >
            Abattoirs and meat processors have historically struggled with the cost and complexity of managing processing residuals. Handling by-products is expensive and environmentally taxing. We provide a guaranteed, end-to-end, safe and practical path that turns what was once a burden into an opportunity for a more sustainable ecology.
          </p>
          {/* Callout quote */}
          <div
            className="glass-card p-6 border-l-2"
            style={{ borderLeftColor: '#12cd80' }}
          >
            <p
              className="text-base italic leading-relaxed m-0"
              style={{ color: 'rgba(255,255,255,0.7)', fontFamily: "'Inter', sans-serif" }}
            >
              "What was once a burden becomes a measurable sustainability advantage — for your business and your community."
            </p>
          </div>
        </div>

        {/* Image */}
        <div
          className="w-full lg:w-1/2 shrink-0 rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <img src={imgWhyWeExist} alt="Our sheep farm" className="w-full h-auto object-cover" />
        </div>
      </div>
    </section>
  );
}

export default WhyWeExist;
