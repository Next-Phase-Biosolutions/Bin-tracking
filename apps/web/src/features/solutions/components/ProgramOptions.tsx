import React from 'react';
import { Check } from 'lucide-react';

const imgVector9 = "/assets/bolt.png";

interface PricingCardProps {
    title: string;
    price: string;
    yearly: string;
    features: string[];
}

function PricingCard({ title, price, yearly, features }: PricingCardProps) {
    return (
        <div className="flex flex-col justify-between flex-1 bg-[#f2f2f2] border border-black/15 p-6 lg:p-8 min-h-[auto] lg:min-h-[625px] w-full">
            <div className="flex flex-col gap-8 w-full">
                <div className="flex flex-col gap-4 items-end w-full">
                    <div className="w-6 h-6 overflow-hidden">
                        <img src={imgVector9} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col gap-2 items-start w-full text-black">
                        <p
                            className="font-bold text-2xl lg:text-[26px] leading-snug tracking-tight m-0"
                            style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                            {title}
                        </p>
                        <p
                            className="font-bold m-0 flex items-baseline"
                            style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                            <span className="text-6xl lg:text-[84px] leading-tight tracking-tight">{price}</span>
                            <span className="text-3xl lg:text-[40px] leading-snug tracking-tight">/mo</span>
                        </p>
                        <p
                            className="font-normal text-base lg:text-[18px] leading-relaxed m-0"
                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                            {yearly}
                        </p>
                    </div>
                </div>
                <div className="h-px w-full bg-black/15" />
                <div className="flex flex-col gap-4 w-full">
                    <p
                        className="font-normal text-base lg:text-[18px] text-black leading-relaxed m-0"
                        style={{ fontFamily: "'Open Sans', sans-serif" }}
                    >
                        Includes:
                    </p>
                    <div className="flex flex-col gap-4 py-2 w-full">
                        {features.map((feature, index) => (
                            <div key={index} className="flex gap-4 items-start w-full">
                                <Check className="w-6 h-6 shrink-0 text-[#12cd80]" strokeWidth={3} />
                                <p
                                    className="flex-1 font-normal text-base lg:text-[18px] text-black leading-relaxed m-0"
                                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                                >
                                    {feature}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <button
                className="w-full bg-[#3d5aa8] hover:bg-[#324a8f] text-white font-semibold text-base lg:text-[18px] py-[10px] px-6 rounded-full border-none cursor-pointer transition-colors mt-8 lg:mt-0"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
                Button
            </button>
        </div>
    );
}

export function ProgramOptions() {
    return (
        <section className="w-full bg-[#f8f8f8] py-16 px-4 lg:py-[112px] lg:px-0 overflow-hidden">
            <div className="flex flex-col items-center gap-10 lg:gap-20 max-w-[1280px] mx-auto w-full">
                <h2
                    className="font-bold text-4xl md:text-5xl lg:text-[60px] text-black text-center leading-tight tracking-tight m-0"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                    Program Options
                </h2>

                {/* Mobile Carousel Container */}
                <div className="flex lg:flex-row gap-6 w-full overflow-x-auto snap-x snap-mandatory px-4 lg:px-16 scrollbar-hide pb-4 lg:pb-0">
                    <div className="min-w-[85vw] md:min-w-[400px] lg:min-w-0 lg:flex-1 snap-start shrink-0 flex">
                        <PricingCard
                            title="Basic"
                            price="$19"
                            yearly="or $199 yearly"
                            features={['Collection service', 'Landfill diversion report']}
                        />
                    </div>
                    <div className="min-w-[85vw] md:min-w-[400px] lg:min-w-0 lg:flex-1 snap-start shrink-0 flex">
                        <PricingCard
                            title="Standard"
                            price="$29"
                            yearly="or $299 yearly"
                            features={['Collection', 'Processing', 'Monthly reports', 'Compliance toolkit']}
                        />
                    </div>
                    <div className="min-w-[85vw] md:min-w-[400px] lg:min-w-0 lg:flex-1 snap-start shrink-0 flex">
                        <PricingCard
                            title="Custom"
                            price="$49"
                            yearly="or $499 yearly"
                            features={['Revenue share options', 'Custom sorting', 'On site SOP training']}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

export default ProgramOptions;
