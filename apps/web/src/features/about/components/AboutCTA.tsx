import React from 'react';

const imgCTA_Left = "/assets/aboutus/cows.png";
const imgCTA_Right = "/assets/aboutus/house.png";

export function AboutCTA() {
    return (
        <section className="bg-[#3b7d3f] w-full py-16 lg:py-24 px-6 md:px-16 overflow-hidden relative">
            <div className="max-w-[1280px] mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20">

                {/* Left Image (decorative) */}
                <div className="hidden lg:block w-[300px] h-[200px] rounded-xl overflow-hidden shrink-0 shadow-lg border-4 border-white/20">
                    <img
                        src={imgCTA_Left}
                        alt="Farm Sunlight"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Center Content */}
                <div className="flex flex-col items-center text-center gap-8 max-w-[500px] mx-auto flex-1">
                    <h2
                        className="font-bold text-3xl md:text-[48px] text-white leading-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Ready to Connect With Our Team?
                    </h2>
                    <button
                        className="bg-white hover:bg-gray-100 text-[#043f2e] font-bold text-lg px-8 py-4 rounded-full transition-colors shadow-md"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Talk to a Team Member
                    </button>
                </div>

                {/* Right Image (decorative) */}
                <div className="hidden lg:block w-[300px] h-[200px] rounded-xl overflow-hidden shrink-0 shadow-lg border-4 border-white/20">
                    <img
                        src={imgCTA_Right}
                        alt="Farm Building"
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>
        </section>
    );
}

export default AboutCTA;
