import { CheckItem } from "./CheckItem";

const imgProblem = "/assets/imgProblem.jpg";

export function TheProblem() {
  return (
    <section className="section-dark py-20 px-5 md:py-28 md:px-16 overflow-hidden">
      {/* Liquid blob accent */}
      <div
        className="liquid-blob-2"
        style={{
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(4,63,46,0.35), transparent 65%)',
          top: '10%', right: '-10%',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
        {/* Image panel */}
        <div
          className="w-full lg:w-1/2 shrink-0 rounded-2xl overflow-hidden aspect-4/3 lg:h-110 relative"
          style={{
            border: '1px solid rgba(18,205,128,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(18,205,128,0.06)',
          }}
        >
          <img src={imgProblem} alt="The Problem" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(18,205,128,0.06) 0%, transparent 50%, rgba(0,0,0,0.25) 100%)' }}
          />
        </div>

        {/* Content */}
        <div className="w-full lg:w-1/2 flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <div className="accent-line" />
            <h2
              className="font-bold text-3xl md:text-5xl leading-tight tracking-tight text-white m-0"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              The Problem
            </h2>
          </div>
          <p
            className="text-base md:text-lg leading-relaxed m-0"
            style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter', sans-serif" }}
          >
            Abattoirs face mounting pressure to deal with by-products responsibly — but current options are costly, risky, and hard to keep up with.
          </p>
          <div className="flex flex-col gap-4">
            <CheckItem text="Disposal is expensive and creates ongoing financial risk." />
            <CheckItem text="Landfill creates odour, pests, and serious environmental pollution." />
            <CheckItem text="Regulations change often and add extra compliance work for your team." />
          </div>
        </div>
      </div>
    </section>
  );
}
