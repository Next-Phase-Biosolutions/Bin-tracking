const imgPartner1 = "/assets/imgPartner1.png";
const imgPartner2 = "/assets/imgPartner2.png";
const imgPartner3 = "/assets/imgPartner3.png";
const imgPartner4 = "/assets/imgPartner4.png";

const partners = [
    { img: imgPartner1, alt: "Partner 1" },
    { img: imgPartner2, alt: "Partner 2" },
    { img: imgPartner3, alt: "Partner 3" },
    { img: imgPartner4, alt: "Partner 4" },
];

export function Partners() {
    return (
        <section
            style={{
                backgroundColor: "#eef2e3",
                padding: "80px 64px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 40,
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
                    textAlign: "center",
                    margin: 0,
                }}
            >
                Our Trust Factors
            </h2>

            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 120,    // Space between logos
                    flexWrap: "wrap",
                }}
            >
                {partners.map((p, i) => (
                    <img
                        key={i}
                        src={p.img}
                        alt={p.alt}
                        style={{
                            height: 60, // Set consistent height
                            width: "auto", // Keep aspect ratio
                            objectFit: "contain",
                        }}
                    />
                ))}
            </div>
        </section>
    );
}
