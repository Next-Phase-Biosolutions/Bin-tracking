const imgCloseUpCobblerUsingSewingMachine = "https://www.figma.com/api/mcp/asset/49eafe8f-73e0-4f8a-bc27-bf38de4474b4";

export function SolutionsHero() {
    return (
        <section
            style={{
                position: "relative",
                width: "100%",
                height: 800,
                backgroundColor: "transparent",
                overflow: "hidden",
            }}
        >
            {/* Background image */}
            <img
                src={imgCloseUpCobblerUsingSewingMachine}
                alt=""
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
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
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 24,
                        maxWidth: 768,
                        width: "100%",
                        padding: "0 20px",
                    }}
                >
                    <h1
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: 68,
                            color: "white",
                            textAlign: "center",
                            lineHeight: 1.2,
                            letterSpacing: "-0.68px",
                            margin: 0,
                        }}
                    >
                        The Zero Waste Program for Abattoirs
                    </h1>
                    <p
                        style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 22,
                            color: "white",
                            textAlign: "center",
                            lineHeight: 1.5,
                            margin: 0,
                        }}
                    >
                        A simple, closed loop system that turns your by products into value while reducing risk and landfill waste.
                    </p>
                    <button
                        style={{
                            backgroundColor: "#043f2e",
                            color: "white",
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                            fontSize: 20,
                            padding: "15px 30px",
                            borderRadius: 100,
                            border: "none",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#032a1f")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#043f2e")}
                    >
                        Request a Zero Waste Audit
                    </button>
                </div>
            </div>
        </section>
    );
}

export default SolutionsHero;
