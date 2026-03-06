import React from 'react';

export function HowWereDifferent() {
    return (
        <section className="bg-[#f2f6ee] py-16 lg:py-[100px] px-6 md:px-16 w-full">
            <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-12 lg:gap-16">

                <h2
                    className="font-bold text-3xl md:text-[40px] text-black text-center leading-tight m-0"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                    How We're Different
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 w-full">
                    {/* Column 1 */}
                    <div className="flex flex-col gap-4">
                        <h3
                            className="font-semibold text-xl lg:text-2xl text-black leading-snug m-0"
                            style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                            Local to Nimble
                        </h3>
                        <p
                            className="font-normal text-base text-black/80 leading-relaxed m-0"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            We are locally tied to farms and communities here, and can actively adapt
                            solutions to match volume fluctuations.
                        </p>
                    </div>

                    {/* Column 2 */}
                    <div className="flex flex-col gap-4">
                        <h3
                            className="font-semibold text-xl lg:text-2xl text-black leading-snug m-0"
                            style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                            Transparent
                        </h3>
                        <p
                            className="font-normal text-base text-black/80 leading-relaxed m-0"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            Our process is open door—there's no mystery involved. We ensure that you
                            see where your materials are heading into, giving you maximum efficiency in reporting.
                        </p>
                    </div>

                    {/* Column 3 */}
                    <div className="flex flex-col gap-4">
                        <h3
                            className="font-semibold text-xl lg:text-2xl text-black leading-snug m-0"
                            style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                            Practical & Reliable
                        </h3>
                        <p
                            className="font-normal text-base text-black/80 leading-relaxed m-0"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            We serve as a 100% dependable and secure solution that handles the heavy
                            lifting, producing consistently, and is a complete system ready to use.
                        </p>
                    </div>
                </div>

            </div>
        </section>
    );
}

export default HowWereDifferent;
