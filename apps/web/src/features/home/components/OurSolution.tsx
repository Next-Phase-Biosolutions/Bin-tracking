import { CheckItem } from "./CheckItem";

const imgSolution = "/assets/imgSolution.jpg";

export function OurSolution() {
    return (
        <section
            style={{
                backgroundColor: "#f8f8f8",
                padding: "112px 64px",
                display: "flex",
                justifyContent: "center",
                overflow: "hidden",
            }}
        >
            <div style={{ display: "flex", gap: 80, alignItems: "center" }}>
                {/* Content */}
                <div style={{ width: 544, display: "flex", flexDirection: "column", gap: 24 }}>
                    <h2
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: 48,
                            lineHeight: 1.2,
                            letterSpacing: "-0.48px",
                            color: "black",
                            margin: 0,
                        }}
                    >
                        Our Solution
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <CheckItem text="We collect hides, skins, fats, and selected off cuts from your plant." />
                        <CheckItem text="We upcycle these materials into useful inputs such as collagen pathways, leather inputs, and bio oils." />
                        <CheckItem text="We provide clear monthly reports that show how much waste is diverted from landfill." />
                    </div>
                </div>

                {/* Image */}
                <div
                    style={{
                        width: 600,
                        height: 400,
                        borderRadius: 10,
                        overflow: "hidden",
                        flexShrink: 0,
                    }}
                >
                    <img
                        src={imgSolution}
                        alt="Solution"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                </div>
            </div>
        </section>
    );
}
