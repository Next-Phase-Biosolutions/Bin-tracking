const imgMap = "/assets/aboutus/map.png";

export function ServiceArea() {
  return (
    <section className="section-dark py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white leading-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Service Area
          </h2>
          <p
            className="text-base md:text-lg"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Inter', sans-serif" }}
          >
            2910 Highway 7A Scugog, Ontario L0B1B0, Canada — serving within 200 km
          </p>
        </div>

        {/* Map in glass frame */}
        <div
          className="w-full h-100 lg:h-150 rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src={imgMap}
            alt="Service Area Map"
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(0.7) brightness(0.85)' }}
          />
        </div>
      </div>
    </section>
  );
}

export default ServiceArea;
