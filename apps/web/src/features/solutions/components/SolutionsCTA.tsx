import React from 'react';

const imgCtaBg = "/assets/imgCtaBg.png";
const imgCtaVector = "/assets/imgCtaVector.png";

export function SolutionsCTA() {
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
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 24,
                        color: "white",
                        textAlign: "center",
                        width: "100%",
                    }}
                >
                    <h2
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: 68,
                            lineHeight: 1.2,
                            letterSpacing: "-0.68px",
                            margin: 0,
                        }}
                    >
                        Start Your Zero<br />Waste Program
                    </h2>
                    <p
                        style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 22,
                            lineHeight: 1.5,
                            margin: 0,
                        }}
                    >
                        Get a simple audit of your plant. We review your by product streams and show how much waste you can divert from landfill.
                    </p>
                </div>
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
                        transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#032a1f")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#043f2e")}
                >
                    Contact Our Team
                </button>
            </div>
        </section>
    );
}

export default SolutionsCTA;
