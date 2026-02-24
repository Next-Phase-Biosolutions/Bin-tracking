const imgHeroOverlay = "/assets/imgHeroOverlay.png";
const imgHeroVector = "/assets/imgHeroVector.png";

export function Hero() {
    return (
        <section
            style={{
                position: "relative",
                height: 800,
                overflow: "hidden",
                // Remove the f1ede2 background, just let the image fill the container
                backgroundColor: "transparent",
            }}
        >
            {/* Background images */}
            <img
                src={imgHeroOverlay}
                alt=""
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover", // ensures it fills exactly 800px tall
                    pointerEvents: "none",
                }}
            />
            <img
                src={imgHeroVector}
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

            {/* Content */}
            <div
                style={{
                    position: "relative",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 92,
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: 768 }}>
                    <h1
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: 68,
                            lineHeight: 1.2,
                            letterSpacing: "-0.68px",
                            color: "white",
                            marginBottom: 24,
                        }}
                    >
                        Zero Waste Solutions for Abattoirs
                    </h1>
                    <p
                        style={{
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 400,
                            fontSize: 22,
                            lineHeight: 1.5,
                            color: "white",
                            marginBottom: 24,
                        }}
                    >
                        We turn by products that usually go to landfill into useful materials. Safe, local, and compliant.
                    </p>
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
                        Book a Zero Waste
                    </button>
                </div>
            </div>
        </section>
    );
}
