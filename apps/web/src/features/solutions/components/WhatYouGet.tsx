import React from 'react';

const img11 = "https://www.figma.com/api/mcp/asset/c24f0e38-339d-4bd7-bb77-786907f1aff0";
const img21 = "https://www.figma.com/api/mcp/asset/600a67da-3602-4f35-8923-a2d1f7ac24d3";
const img37 = "https://www.figma.com/api/mcp/asset/43b00609-8582-4a50-bc81-afd0c318169b";
const imgFarmerCowshedLookingAfterCows1 = "https://www.figma.com/api/mcp/asset/9637e852-619a-4e73-8ce7-ad40873f5ace";
const imgGroup23 = "https://www.figma.com/api/mcp/asset/4c07993e-b23e-4539-b17f-3f7aca39bd34";

function CheckIcon() {
    return (
        <img
            src={imgGroup23}
            alt=""
            className="w-[30.5px] h-[30.5px] shrink-0 object-contain"
        />
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3 w-full">
            <CheckIcon />
            <p
                className="font-normal text-lg md:text-[20px] text-black leading-relaxed m-0"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
                {text}
            </p>
        </div>
    );
}

export function WhatYouGet() {
    return (
        <section className="w-full bg-white py-16 px-4 lg:py-[112px] lg:px-16 overflow-hidden">
            <div className="flex flex-col items-center gap-12 lg:gap-20 max-w-[1440px] mx-auto w-full">
                <h2
                    className="font-bold text-3xl md:text-5xl lg:text-[48px] text-black text-center leading-tight tracking-tight max-w-[768px] w-full m-0"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                    What You Get
                </h2>

                <div className="flex flex-col gap-16 lg:gap-10 w-full">
                    {/* Collection and Logistics */}
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-20 w-full">
                        <div className="w-full lg:w-1/2 aspect-video lg:h-[400px] bg-white rounded-[10px] overflow-hidden shrink-0">
                            <img
                                src={img11}
                                alt="Collection bins in facility"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex flex-col gap-6 w-full lg:w-1/2">
                            <h3
                                className="font-bold text-3xl md:text-4xl lg:text-[48px] text-black leading-tight tracking-tight m-0"
                                style={{ fontFamily: "'Montserrat', sans-serif" }}
                            >
                                Collection and Logistics
                            </h3>
                            <div className="flex flex-col gap-3">
                                <FeatureItem text="Clean bins and totes" />
                                <FeatureItem text="Scheduled pickups" />
                                <FeatureItem text="Clear instructions for sorting" />
                                <FeatureItem text="Easy communication with our operations team" />
                            </div>
                        </div>
                    </div>

                    {/* Processing and Upcycling */}
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-20 w-full">
                        <div className="flex flex-col gap-6 w-full lg:w-1/2 order-last lg:order-first">
                            <h3
                                className="font-bold text-3xl md:text-4xl lg:text-[48px] text-black leading-tight tracking-tight m-0"
                                style={{ fontFamily: "'Montserrat', sans-serif" }}
                            >
                                Processing and Upcycling
                            </h3>
                            <div className="flex flex-col gap-3">
                                <FeatureItem text="We convert materials into usable inputs" />
                                <FeatureItem text="Output pathways include collagen, leather preparation, tallow, and bio oils" />
                                <FeatureItem text="Safe and compliant processing" />
                            </div>
                        </div>
                        <div className="w-full lg:w-1/2 aspect-video lg:h-[400px] bg-white rounded-[10px] overflow-hidden shrink-0 order-first lg:order-last">
                            <img
                                src={img21}
                                alt="Laboratory processing"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                    {/* Traceability and Reporting */}
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-20 w-full">
                        <div className="w-full lg:w-1/2 aspect-video lg:h-[400px] bg-white rounded-[10px] overflow-hidden shrink-0">
                            <img
                                src={img37}
                                alt="Reporting dashboard"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex flex-col gap-6 w-full lg:w-1/2">
                            <h3
                                className="font-bold text-3xl md:text-4xl lg:text-[48px] text-black leading-tight tracking-tight m-0"
                                style={{ fontFamily: "'Montserrat', sans-serif" }}
                            >
                                Traceability and Reporting
                            </h3>
                            <div className="flex flex-col gap-3">
                                <FeatureItem text="Monthly landfill diversion report" />
                                <FeatureItem text="Clear weight records and percentages" />
                                <FeatureItem text="Helpful for ESG, audits, and compliance paperwork" />
                            </div>
                        </div>
                    </div>

                    {/* Compliance Support */}
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-20 w-full">
                        <div className="flex flex-col gap-6 w-full lg:w-1/2 order-last lg:order-first">
                            <h3
                                className="font-bold text-3xl md:text-4xl lg:text-[48px] text-black leading-tight tracking-tight m-0"
                                style={{ fontFamily: "'Montserrat', sans-serif" }}
                            >
                                Compliance Support
                            </h3>
                            <div className="flex flex-col gap-3">
                                <FeatureItem text="SOPs for sorting and handling" />
                                <FeatureItem text="Documentation we follow on site" />
                                <FeatureItem text="Licensed transport and safe handling practices" />
                            </div>
                        </div>
                        <div className="w-full lg:w-1/2 aspect-video lg:h-[400px] bg-white rounded-[10px] overflow-hidden shrink-0 order-first lg:order-last">
                            <img
                                src={imgFarmerCowshedLookingAfterCows1}
                                alt="Farm compliance"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default WhatYouGet;
