import React from 'react';

export function ProcessCTA() {
    return (
        <section className="bg-[#f0ece1] py-16 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12">

                    {/* Left Image */}
                    <div className="w-full md:w-1/4 aspect-[4/3] rounded-xl overflow-hidden shadow-lg order-2 md:order-1 hidden md:block">
                        <img
                            src="/assets/process/soil.png"
                            alt="Soil and plants"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Center Content */}
                    <div className="w-full md:w-1/2 text-center order-1 md:order-2">
                        <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                            Ready to Start<br />Your Zero-Waste<br />Program?
                        </h2>
                        <p className="text-lg text-gray-700 mb-8 mx-auto max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
                            A clean, efficient factory team managing zero-waste collection and reporting process.
                        </p>
                        <button className="bg-[#0b5c3b] hover:bg-[#08482f] text-white font-semibold py-3 px-8 rounded-full transition-colors duration-300">
                            Book a Zero Waste Audit
                        </button>
                    </div>

                    {/* Right Image */}
                    <div className="w-full md:w-1/4 aspect-[3/4] rounded-xl overflow-hidden shadow-lg order-3 md:order-3 hidden md:block">
                        <img
                            src="/assets/process/paper.png"
                            alt="Working hands"
                            className="w-full h-full object-cover"
                        />
                    </div>

                </div>
            </div>
        </section>
    );
}
