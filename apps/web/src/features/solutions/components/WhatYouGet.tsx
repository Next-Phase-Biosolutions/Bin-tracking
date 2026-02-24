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
            style={{ width: 30.5, height: 30.5, flexShrink: 0 }}
        />
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
            <CheckIcon />
            <p
                style={{
                    fontFamily: "'Open Sans', sans-serif",
                    fontSize: 20,
                    color: "black",
                    lineHeight: 1.5,
                    margin: 0,
                }}
            >
                {text}
            </p>
        </div>
    );
}

export function WhatYouGet() {
    return (
        <section
            style={{
                width: "100%",
                backgroundColor: "white",
                padding: "112px 64px",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 80,
                    maxWidth: 1440,
                    margin: "0 auto",
                }}
            >
                <h2
                    style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 700,
                        fontSize: 48,
                        color: "black",
                        textAlign: "center",
                        letterSpacing: "-0.48px",
                        lineHeight: 1.2,
                        width: 768,
                        margin: 0,
                    }}
                >
                    What You Get
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 40, width: "100%" }}>
                    {/* Collection and Logistics */}
                    <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
                        <div
                            style={{
                                width: 600,
                                height: 400,
                                backgroundColor: "white",
                                borderRadius: 10,
                                overflow: "hidden",
                                flexShrink: 0,
                            }}
                        >
                            <img
                                src={img11}
                                alt="Collection bins in facility"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 544 }}>
                            <h3
                                style={{
                                    fontFamily: "'Montserrat', sans-serif",
                                    fontWeight: 700,
                                    fontSize: 48,
                                    color: "black",
                                    letterSpacing: "-0.48px",
                                    lineHeight: 1.2,
                                    margin: 0,
                                }}
                            >
                                Collection and Logistics
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <FeatureItem text="Clean bins and totes" />
                                <FeatureItem text="Scheduled pickups" />
                                <FeatureItem text="Clear instructions for sorting" />
                                <FeatureItem text="Easy communication with our operations team" />
                            </div>
                        </div>
                    </div>

                    {/* Processing and Upcycling */}
                    <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 544 }}>
                            <h3
                                style={{
                                    fontFamily: "'Montserrat', sans-serif",
                                    fontWeight: 700,
                                    fontSize: 48,
                                    color: "black",
                                    letterSpacing: "-0.48px",
                                    lineHeight: 1.2,
                                    margin: 0,
                                }}
                            >
                                Processing and Upcycling
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <FeatureItem text="We convert materials into usable inputs" />
                                <FeatureItem text="Output pathways include collagen, leather preparation, tallow, and bio oils" />
                                <FeatureItem text="Safe and compliant processing" />
                            </div>
                        </div>
                        <div
                            style={{
                                width: 600,
                                height: 400,
                                backgroundColor: "white",
                                borderRadius: 10,
                                overflow: "hidden",
                                flexShrink: 0,
                            }}
                        >
                            <img
                                src={img21}
                                alt="Laboratory processing"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </div>
                    </div>

                    {/* Traceability and Reporting */}
                    <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
                        <div
                            style={{
                                width: 600,
                                height: 400,
                                backgroundColor: "white",
                                borderRadius: 10,
                                overflow: "hidden",
                                flexShrink: 0,
                            }}
                        >
                            <img
                                src={img37}
                                alt="Reporting dashboard"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 544 }}>
                            <h3
                                style={{
                                    fontFamily: "'Montserrat', sans-serif",
                                    fontWeight: 700,
                                    fontSize: 48,
                                    color: "black",
                                    letterSpacing: "-0.48px",
                                    lineHeight: 1.2,
                                    margin: 0,
                                }}
                            >
                                Traceability and Reporting
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <FeatureItem text="Monthly landfill diversion report" />
                                <FeatureItem text="Clear weight records and percentages" />
                                <FeatureItem text="Helpful for ESG, audits, and compliance paperwork" />
                            </div>
                        </div>
                    </div>

                    {/* Compliance Support */}
                    <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 544 }}>
                            <h3
                                style={{
                                    fontFamily: "'Montserrat', sans-serif",
                                    fontWeight: 700,
                                    fontSize: 48,
                                    color: "black",
                                    letterSpacing: "-0.48px",
                                    lineHeight: 1.2,
                                    margin: 0,
                                }}
                            >
                                Compliance Support
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <FeatureItem text="SOPs for sorting and handling" />
                                <FeatureItem text="Documentation we follow on site" />
                                <FeatureItem text="Licensed transport and safe handling practices" />
                            </div>
                        </div>
                        <div
                            style={{
                                width: 600,
                                height: 400,
                                backgroundColor: "white",
                                borderRadius: 10,
                                overflow: "hidden",
                                flexShrink: 0,
                            }}
                        >
                            <img
                                src={imgFarmerCowshedLookingAfterCows1}
                                alt="Farm compliance"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default WhatYouGet;
