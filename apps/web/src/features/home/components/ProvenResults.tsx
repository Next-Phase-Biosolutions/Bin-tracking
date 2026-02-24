const results = [
    { stat: "72", desc: "tonnes diverted from landfill in the last 6 months" },
    { stat: "35%", desc: "average reduction in disposal cost at pilot sites" },
    { stat: "48 hrs", desc: "typical onboarding to schedule first pickup" },
];

export function ProvenResults() {
    return (
        <section
            style={{
                backgroundColor: "#2a6f2b",
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
                    color: "white",
                    marginBottom: 40,
                    textAlign: "center",
                    width: 768,
                }}
            >
                Proven Results
            </h2>
            <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
                {results.map((r) => (
                    <div key={r.stat} style={{ width: 326, display: "flex", flexDirection: "column", gap: 18 }}>
                        <p
                            style={{
                                fontFamily: "'Montserrat', sans-serif",
                                fontWeight: 700,
                                fontSize: 72,
                                lineHeight: 1.2,
                                letterSpacing: "-0.72px",
                                color: "white",
                                margin: 0,
                            }}
                        >
                            {r.stat}
                        </p>
                        <p
                            style={{
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 400,
                                fontSize: 22,
                                lineHeight: 1.5,
                                letterSpacing: "-0.22px",
                                color: "white",
                                margin: 0,
                            }}
                        >
                            {r.desc}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
