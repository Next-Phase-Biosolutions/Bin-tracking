import { CheckItem } from "./CheckItem";

const imgSolution = "/assets/imgSolution.jpg";

export function OurSolution() {
  return (
    <section className="section-dark-2 py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      {/* Liquid blob accent */}
      <div
        className="liquid-blob"
        style={{
          width: 550, height: 500,
          background: 'radial-gradient(circle, rgba(18,205,128,0.08), transparent 65%)',
          top: '5%', left: '-8%',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col-reverse lg:flex-row gap-12 lg:gap-20 items-center">
        {/* Content */}
        <div className="w-full lg:w-1/2 flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <div className="accent-line" />
            <h2
              className="font-bold text-3xl md:text-5xl leading-tight tracking-tight text-white m-0"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Our Solution
            </h2>
          </div>
          <p
            className="text-base md:text-lg leading-relaxed m-0"
            style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter', sans-serif" }}
          >
            A simple, closed-loop system that transforms your by-product problem into a sustainability advantage.
          </p>
          <div className="flex flex-col gap-4">
            <CheckItem text="We collect hides, skins, fats, and selected off-cuts from your plant." />
            <CheckItem text="We upcycle materials into collagen pathways, leather inputs, and bio-oils." />
            <CheckItem text="We provide clear monthly reports showing how much waste is diverted from landfill." />
          </div>
        </div>

        {/* Image panel */}
        <div
          className="w-full lg:w-1/2 shrink-0 rounded-2xl overflow-hidden aspect-3/2 lg:h-110 relative"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(18,205,128,0.06)',
          }}
        >
          <img src={imgSolution} alt="Our Solution" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(225deg, rgba(18,205,128,0.06) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)' }}
          />
        </div>
      </div>
    </section>
  );
}
