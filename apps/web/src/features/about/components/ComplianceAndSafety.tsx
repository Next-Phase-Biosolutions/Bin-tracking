import React from 'react';

const imgBadge = "/assets/aboutus/badge.png";
const imgSop = "/assets/aboutus/sop.png";
const imgHelmet = "/assets/aboutus/helmet.png";

export function ComplianceAndSafety() {
    return (
        <section className="bg-[#3b7d3f] py-16 lg:py-[100px] px-6 md:px-16 w-full text-white">
            <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-12 lg:gap-16">

                <h2
                    className="font-bold text-3xl md:text-[40px] text-white text-center leading-tight m-0"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                    Compliance & Safety
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20 w-full items-start">
                    {/* Item 1 */}
                    <div className="flex flex-col items-center text-center gap-6">
                        <div className="w-[80px] h-[80px] flex items-center justify-center rounded-full bg-white/10   overflow-hidden">
                            <img src={imgBadge} alt="Licensed handling" className="w-[90px] h-[90px] object-contain" />
                        </div>
                        <p
                            className="font-medium text-lg lg:text-xl text-white leading-snug m-0"
                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                            Licensed handling and transport
                        </p>
                    </div>

                    {/* Item 2 */}
                    <div className="flex flex-col items-center text-center gap-6">
                        <div className="w-[80px] h-[80px] flex items-center justify-center rounded-full bg-white/10 overflow-hidden">
                            <img src={imgSop} alt="SOPs for sanitation" className="w-[90px] h-[90px] object-contain" />
                        </div>
                        <p
                            className="font-medium text-lg lg:text-xl text-white leading-snug m-0"
                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                            SOPs for sanitation and separation.
                        </p>
                    </div>

                    {/* Item 3 */}
                    <div className="flex flex-col items-center text-center gap-6">
                        <div className="w-[80px] h-[80px] flex items-center justify-center rounded-full bg-white/10 overflow-hidden">
                            <img src={imgHelmet} alt="Staff training" className="w-[90px] h-[90px] object-contain" />
                        </div>
                        <p
                            className="font-medium text-lg lg:text-xl text-white leading-snug m-0"
                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                            Staff training and PPE.
                        </p>
                    </div>
                </div>

            </div>
        </section>
    );
}

export default ComplianceAndSafety;
