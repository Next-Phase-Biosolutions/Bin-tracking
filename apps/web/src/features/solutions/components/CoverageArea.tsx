import React from 'react';

const imgNpDigitalKreativaStudio2 = "https://www.figma.com/api/mcp/asset/52f7a81e-08b0-490a-8584-6eadc5bb86a7";

export function CoverageArea() {
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
                    maxWidth: 1280,
                    margin: "0 auto",
                    width: "100%",
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
                        Coverage Area
                    </h2>
                    <p
                        style={{
                            fontFamily: "'Open Sans', sans-serif",
                            fontSize: 18,
                            color: "black",
                            textAlign: "center",
                            lineHeight: 1.5,
                            margin: 0,
                        }}
                    >
                        We serve up to 200 km around Scugog, Ontario.<br />
                        Call us if your plant is outside the area.
                    </p>
                </div>
                <div
                    style={{
                        width: "100%",
                        maxWidth: 1280,
                        height: 450,
                        overflow: "hidden",
                    }}
                >
                    <img
                        src={imgNpDigitalKreativaStudio2}
                        alt="Coverage Map"
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                    />
                </div>
            </div>
        </section>
    );
}

export default CoverageArea;
