import React from 'react';

const imgVector9 = "https://www.figma.com/api/mcp/asset/2e5f25a1-b553-46a2-b7da-c01f97c49675";
const imgCheck = "https://www.figma.com/api/mcp/asset/77ba96ef-9694-4a9c-ac4b-94a99ed76b13";

interface PricingCardProps {
    title: string;
    price: string;
    yearly: string;
    features: string[];
}

function PricingCard({ title, price, yearly, features }: PricingCardProps) {
    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                backgroundColor: "#f2f2f2",
                border: "1px solid rgba(0,0,0,0.15)",
                padding: 32,
                minHeight: 625,
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end", width: "100%" }}>
                    <div style={{ width: 24, height: 24, overflow: "hidden" }}>
                        <img src={imgVector9} alt="" style={{ width: "100%", height: "100%" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", width: "100%", color: "black" }}>
                        <p
                            style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontWeight: 700,
                                fontSize: 26,
                                lineHeight: 1.4,
                                letterSpacing: "-0.26px",
                                margin: 0,
                            }}
                        >
                            {title}
                        </p>
                        <p
                            style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontWeight: 700,
                                margin: 0,
                                display: "flex",
                                alignItems: "baseline",
                            }}
                        >
                            <span style={{ fontSize: 84, lineHeight: 1.1, letterSpacing: "-0.84px" }}>{price}</span>
                            <span style={{ fontSize: 40, lineHeight: 1.3, letterSpacing: "-0.4px" }}>/mo</span>
                        </p>
                        <p
                            style={{
                                fontFamily: "'Open Sans', sans-serif",
                                fontSize: 18,
                                lineHeight: 1.5,
                                margin: 0,
                            }}
                        >
                            {yearly}
                        </p>
                    </div>
                </div>
                <div style={{ height: 1, width: "100%", backgroundColor: "rgba(0,0,0,0.15)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                    <p
                        style={{
                            fontFamily: "'Open Sans', sans-serif",
                            fontSize: 18,
                            color: "black",
                            lineHeight: 1.5,
                            margin: 0,
                        }}
                    >
                        Includes:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0", width: "100%" }}>
                        {features.map((feature, index) => (
                            <div key={index} style={{ display: "flex", gap: 16, alignItems: "flex-start", width: "100%" }}>
                                <img src={imgCheck} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />
                                <p
                                    style={{
                                        flex: 1,
                                        fontFamily: "'Open Sans', sans-serif",
                                        fontSize: 18,
                                        color: "black",
                                        lineHeight: 1.5,
                                        margin: 0,
                                    }}
                                >
                                    {feature}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <button
                style={{
                    width: "100%",
                    backgroundColor: "#3d5aa8",
                    color: "white",
                    fontFamily: "'Open Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: 18,
                    padding: "10px 24px",
                    borderRadius: 100,
                    border: "none",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#324a8f")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3d5aa8")}
            >
                Button
            </button>
        </div>
    );
}

export function ProgramOptions() {
    return (
        <section
            style={{
                width: "100%",
                backgroundColor: "#f8f8f8",
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
                    maxWidth: 1280,
                    margin: "0 auto",
                    width: "100%",
                }}
            >
                <h2
                    style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontWeight: 700,
                        fontSize: 60,
                        color: "black",
                        textAlign: "center",
                        letterSpacing: "-0.6px",
                        lineHeight: 1.2,
                        margin: 0,
                    }}
                >
                    Program Options
                </h2>
                <div style={{ display: "flex", gap: 32, width: "100%" }}>
                    <PricingCard
                        title="Basic"
                        price="$19"
                        yearly="or $199 yearly"
                        features={['Collection service', 'Landfill diversion report']}
                    />
                    <PricingCard
                        title="Standard"
                        price="$29"
                        yearly="or $299 yearly"
                        features={['Collection', 'Processing', 'Monthly reports', 'Compliance toolkit']}
                    />
                    <PricingCard
                        title="Custom"
                        price="$49"
                        yearly="or $499 yearly"
                        features={['Revenue share options', 'Custom sorting', 'On site SOP training']}
                    />
                </div>
            </div>
        </section>
    );
}

export default ProgramOptions;
