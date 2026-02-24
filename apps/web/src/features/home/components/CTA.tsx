const imgCtaBg = "/assets/imgCtaBg.png";
const imgCtaVector = "/assets/imgCtaVector.png";

export function CTA() {
    return (
        <section
            style={{
                position: "relative",
                height: 522,
                overflow: "hidden",
                backgroundColor: "#f1ede2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <img
                src={imgCtaBg}
                alt=""
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                }}
            />
            {/* Dark Filter Overlay covering the image */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    pointerEvents: "none",
                }}
            />
            <img
                src={imgCtaVector}
                alt=""
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "101.5%",
                    pointerEvents: "none",
                }}
            />

            <div
                style={{
                    position: "relative",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 24,
                    textAlign: "center",
                    maxWidth: 768,
                }}
            >
                <h2
                    style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 700,
                        fontSize: 68,
                        lineHeight: 1.2,
                        letterSpacing: "-0.68px",
                        color: "white",
                        margin: 0,
                    }}
                >
                    Ready to Reduce Waste and Costs
                </h2>
                <button
                    style={{
                        backgroundColor: "#043f2e",
                        color: "white",
                        border: "none",
                        borderRadius: 100,
                        padding: "15px 30px",
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        cursor: "pointer",
                        lineHeight: 1.5,
                    }}
                >
                    Book a Zero Waste Audit
                </button>
            </div>
        </section>
    );
}
