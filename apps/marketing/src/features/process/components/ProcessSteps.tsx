import { Check } from 'lucide-react';

const steps = [
  {
    num: "01",
    title: "Plant Audit",
    items: [
      "We visit your facility or hold a video call.",
      "We list all by-product streams (hides, fats, off-cuts, etc.).",
      "We identify quick wins to reduce disposal.",
    ],
  },
  {
    num: "02",
    title: "Plan & Pricing",
    items: [
      "We define what materials we'll handle.",
      "We confirm bin types and pickup frequency.",
      "You receive transparent pricing or a revenue-share option.",
    ],
  },
  {
    num: "03",
    title: "Setup",
    items: [
      "We deliver clean bins or totes.",
      "Sorting labels and a 1-page SOP are provided (with photos).",
      "Your staff knows exactly what to do.",
    ],
  },
  {
    num: "04",
    title: "Pickup & Processing",
    items: [
      "Scheduled pickups based on your operation.",
      "Safe, licensed transport and processing.",
      "Clean collection — no odour or mess.",
    ],
  },
  {
    num: "05",
    title: "Reporting",
    items: [
      "Monthly diversion report: weight, % diverted, CO₂ avoided.",
      "Reports include compliance notes for audits.",
      "Measurable ESG progress.",
    ],
  },
];

export function ProcessSteps() {
  return (
    <section id="steps" className="section-dark-2 py-20 px-5 lg:py-28 lg:px-16 overflow-hidden">
      <div
        className="liquid-blob-2"
        style={{
          width: 700, height: 600,
          background: 'radial-gradient(circle, rgba(18,205,128,0.06), transparent 65%)',
          top: '40%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-3 text-center mb-14">
          <div className="accent-line mx-auto" />
          <h2
            className="font-bold text-3xl md:text-5xl text-white leading-tight tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Step-by-Step Overview
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="glass-card flex flex-col lg:flex-row gap-6 lg:gap-16 p-7 lg:p-10"
            >
              {/* Step number */}
              <div className="lg:w-48 shrink-0 flex lg:flex-col items-center lg:items-start gap-4 lg:gap-3">
                <span
                  className="font-bold text-5xl lg:text-7xl leading-none"
                  style={{ color: 'rgba(18,205,128,0.25)', fontFamily: "'Montserrat', sans-serif" }}
                >
                  {step.num}
                </span>
                <h3
                  className="font-bold text-xl lg:text-2xl text-white m-0"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {step.title}
                </h3>
              </div>

              {/* Vertical divider (desktop) */}
              <div className="hidden lg:block w-px shrink-0 self-stretch" style={{ background: 'rgba(18,205,128,0.15)' }} />

              {/* Items */}
              <ul className="flex flex-col gap-3 flex-1">
                {step.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: 'rgba(18,205,128,0.12)', border: '1px solid rgba(18,205,128,0.3)' }}
                    >
                      <Check className="w-3.5 h-3.5" style={{ color: '#12cd80' }} strokeWidth={3} />
                    </div>
                    <span
                      className="text-base leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.75)', fontFamily: "'Inter', sans-serif" }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
