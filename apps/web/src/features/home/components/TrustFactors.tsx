const imgTrustLocal = "/assets/location.png";
const imgTrustLicensed = "/assets/trust.png";
const imgTrustTrace = "/assets/doc.png";
const imgTrustSetup = "/assets/bolt.png";
const imgTrustReduce = "/assets/recycle.png";

const trustItems = [
    { icon: imgTrustLocal, label: "Local Coverage up to 200 km" },
    { icon: imgTrustLicensed, label: "Licensed and Compliant Handling" },
    { icon: imgTrustTrace, label: "Traceability and Reporting" },
    { icon: imgTrustSetup, label: "Fast, Easy Site Setup." },
    { icon: imgTrustReduce, label: "Reduce Waste and Costs" },
];

export function TrustFactors() {
    return (
        <section
            style={{
                backgroundColor: "#eef2e3",
                padding: "112px 64px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                overflow: "hidden",
            }}
        >
            <h2
                style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: 48,
                    lineHeight: 1.2,
                    letterSpacing: "-0.48px",
                    color: "black",
                    marginBottom: 40,
                    textAlign: "center",
                }}
            >
                Our Trust Factors
            </h2>
            <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
                {trustItems.map((item) => (
                    <div
                        key={item.label}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 12,
                            width: 192,
                        }}
                    >
                        <div
                            style={{
                                position: "relative",
                                width: 94,
                                height: 94,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {/* The SVG background */}
                            <img
                                src="/assets/imgTrustLocal.svg"
                                alt="Background"
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                }}
                            />
                            {/* The foreground icon */}
                            <img
                                src={item.icon}
                                alt={item.label}
                                style={{
                                    position: "relative",
                                    width: 48,   // Slightly smaller to fit inside
                                    height: 48,
                                    zIndex: 1,
                                    objectFit: "contain"
                                }}
                            />
                        </div>
                        <p
                            style={{
                                fontFamily: "'Open Sans', sans-serif",
                                fontWeight: 400,
                                fontSize: 20,
                                lineHeight: 1.5,
                                color: "black",
                                textAlign: "center",
                                margin: 0,
                            }}
                        >
                            {item.label}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
