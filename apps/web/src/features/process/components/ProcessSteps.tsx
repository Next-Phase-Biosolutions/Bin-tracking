import React from 'react';
import { Check } from 'lucide-react';

const steps = [
    {
        title: "Step 1 — Plant Audit",
        items: [
            "We visit your facility or hold a video call.",
            "We list all by-product streams (hides, fats, off-cuts, etc.).",
            "We identify quick wins to reduce disposal."
        ]
    },
    {
        title: "Step 2 — Plan & Pricing",
        items: [
            "We define what materials we'll handle.",
            "We confirm bin types and pickup frequency.",
            "You receive transparent pricing or a revenue-share option."
        ]
    },
    {
        title: "Step 3 — Setup",
        items: [
            "We deliver clean bins or totes.",
            "Sorting labels and a 1-page SOP are provided (with photos).",
            "Your staff knows exactly what to do."
        ]
    },
    {
        title: "Step 4 — Pickup & Processing",
        items: [
            "Scheduled pickups are arranged based on your operation.",
            "Safe, licensed transport and processing.",
            "Clean collection — no odour or mess."
        ]
    },
    {
        title: "Step 5 — Reporting",
        items: [
            "You receive a monthly diversion report (weight, % diverted, CO2 avoided).",
            "Reports include compliance notes for audits.",
            "You can show measurable ESG progress."
        ]
    }
];

export function ProcessSteps() {
    return (
        <section className="bg-[#4b8a4f] py-16 lg:py-24 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl lg:text-4xl font-bold mb-16 text-center lg:text-left" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    Step-by-Step Overview
                </h2>

                <div className="space-y-12 lg:space-y-16">
                    {steps.map((step, index) => (
                        <div key={index} className="flex flex-col lg:flex-row gap-8 lg:gap-16 border-b border-white/20 pb-12 last:border-0 last:pb-0">
                            <div className="lg:w-1/3">
                                <h3 className="text-2xl font-bold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                                    {step.title}
                                </h3>
                            </div>
                            <div className="lg:w-2/3">
                                <ul className="space-y-4">
                                    {step.items.map((item, itemIdx) => (
                                        <li key={itemIdx} className="flex items-start gap-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="bg-white rounded-full p-1">
                                                    <Check className="w-5 h-5 text-[#4b8a4f]" strokeWidth={3} />
                                                </div>
                                            </div>
                                            <span className="text-lg">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
