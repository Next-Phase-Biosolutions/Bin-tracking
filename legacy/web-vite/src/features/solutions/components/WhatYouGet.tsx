import { Check } from 'lucide-react';

const img11 = "/assets/solutions/sol1.png";
const img21 = "/assets/solutions/sol2.png";
const img37 = "/assets/solutions/sol3.png";
const imgFarmerCows = "/assets/solutions/sol4.png";

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: 'rgba(18,205,128,0.12)', border: '1px solid rgba(18,205,128,0.3)' }}
      >
        <Check className="w-3.5 h-3.5" style={{ color: '#12cd80' }} strokeWidth={3} />
      </div>
      <p
        className="text-base md:text-lg leading-relaxed m-0"
        style={{ color: 'rgba(255,255,255,0.75)', fontFamily: "'Open Sans', sans-serif" }}
      >
        {text}
      </p>
    </div>
  );
}

const services = [
  {
    img: img11,
    title: "Collection and Logistics",
    features: ["Clean bins and totes", "Scheduled pickups", "Clear instructions for sorting", "Easy communication with our ops team"],
    flip: false,
  },
  {
    img: img21,
    title: "Processing and Upcycling",
    features: ["We convert materials into usable inputs", "Collagen, leather prep, tallow, and bio-oils", "Safe and compliant processing"],
    flip: true,
  },
  {
    img: img37,
    title: "Traceability and Reporting",
    features: ["Monthly landfill diversion report", "Clear weight records and percentages", "Helpful for ESG, audits, and compliance"],
    flip: false,
  },
  {
    img: imgFarmerCows,
    title: "Compliance Support",
    features: ["SOPs for sorting and handling", "Documentation we follow on site", "Licensed transport and safe handling"],
    flip: true,
  },
];

export function WhatYouGet() {
  return (
    <section className="section-dark py-20 px-5 lg:py-28 lg:px-16 overflow-hidden">
      <div className="flex flex-col items-center gap-16 max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white text-center leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            What You Get
          </h2>
        </div>

        <div className="flex flex-col gap-16 w-full">
          {services.map((s) => (
            <div
              key={s.title}
              className={`flex flex-col ${s.flip ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-10 lg:gap-16`}
            >
              {/* Image */}
              <div
                className="w-full lg:w-1/2 shrink-0 rounded-2xl overflow-hidden aspect-4/3 lg:h-96 relative"
                style={{
                  border: '1px solid rgba(18,205,128,0.15)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                }}
              >
                <img src={s.img} alt={s.title} className="w-full h-full object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(135deg, rgba(18,205,128,0.05) 0%, transparent 60%)' }}
                />
              </div>

              {/* Content */}
              <div className="w-full lg:w-1/2 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="accent-line" />
                  <h3
                    className="font-bold text-2xl md:text-4xl text-white leading-tight tracking-tight m-0"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {s.title}
                  </h3>
                </div>
                <div className="flex flex-col gap-3">
                  {s.features.map((f) => <FeatureItem key={f} text={f} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhatYouGet;
