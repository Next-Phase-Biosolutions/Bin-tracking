const imgMap = "/assets/solutions/map.png";

export function CoverageArea() {
  return (
    <section className="section-dark py-20 px-5 lg:py-28 lg:px-16 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3 text-center max-w-2xl">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white text-center leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Coverage Area
          </h2>
          <p
            className="text-base md:text-lg text-center"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Open Sans', sans-serif" }}
          >
            We serve up to 200 km around Scugog, Ontario. Call us if your plant is outside the area.
          </p>
        </div>

        <div
          className="w-full h-75 md:h-112 rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src={imgMap}
            alt="Coverage Map"
            className="w-full h-full object-cover object-center"
            style={{ filter: 'saturate(0.7) brightness(0.8)' }}
          />
        </div>
      </div>
    </section>
  );
}

export default CoverageArea;
