import React from 'react';

export function ProcessHero() {
    return (
        <section className="bg-white py-16 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                            Simple 5-Step Process
                        </h1>
                        <p className="text-lg text-gray-600 mb-8" style={{ fontFamily: "'Inter', sans-serif" }}>
                            We make landfill diversion simple. Our five-step process
                            helps your plant turn by-products into value, safely and compliantly.
                        </p>
                        <button className="bg-[#0b5c3b] hover:bg-[#08482f] text-white font-semibold py-3 px-8 rounded-full transition-colors duration-300">
                            Get in Touch
                        </button>
                    </div>
                    <div className="relative h-[400px] lg:h-[500px] rounded-xl overflow-hidden shadow-xl">
                        {/* Placeholder for the loading docks image */}
                        <img
                            src="/assets/process/truck.png"
                            alt="Loading docks"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
