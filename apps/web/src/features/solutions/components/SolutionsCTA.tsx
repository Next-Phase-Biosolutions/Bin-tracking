import React from 'react';

const imgCtaBg = "/assets/imgCtaBg.png";
const imgCtaVector = "/assets/imgCtaVector.png";

export function SolutionsCTA() {
    return (
        <section className="relative min-h-[400px] lg:min-h-[522px] overflow-hidden bg-[#f1ede2] flex items-center justify-center py-16 px-4">
            {/* Background images */}
            <div className="absolute inset-0 z-0">
                <img
                    src={imgCtaBg}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                />
            </div>
            {/* Dark Filter Overlay covering the image */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none z-0" />
            <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                    src={imgCtaVector}
                    alt=""
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] md:w-[101.5%] pointer-events-none"
                />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-[768px] w-full px-4">
                <div className="flex flex-col items-center gap-6 text-white text-center w-full">
                    <h2
                        className="font-bold text-4xl md:text-5xl lg:text-[68px] leading-tight tracking-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Start Your Zero<br />Waste Program
                    </h2>
                    <p
                        className="font-normal text-lg md:text-[22px] leading-relaxed m-0"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Get a simple audit of your plant. We review your by product streams and show how much waste you can divert from landfill.
                    </p>
                </div>
                <button
                    className="bg-[#043f2e] hover:bg-[#032a1f] text-white border-none rounded-full px-6 py-3 lg:px-[30px] lg:py-[15px] font-semibold text-lg md:text-[20px] cursor-pointer leading-relaxed transition-colors"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                >
                    Contact Our Team
                </button>
            </div>
        </section>
    );
}

export default SolutionsCTA;
