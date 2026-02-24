import { CheckItem } from "./CheckItem";

const imgProblem = "/assets/imgProblem.jpg";

export function TheProblem() {
    return (
        <section
            style={{
                backgroundColor: "white",
                padding: "112px 64px",
                display: "flex",
                justifyContent: "center",
                overflow: "hidden",
            }}
        >
            <div style={{ display: "flex", gap: 80, alignItems: "center" }}>
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
                        src={imgProblem}
                        alt="Problem"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                </div>

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
                        The Problem
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <CheckItem text="Disposal is expensive and risky." />
                        <CheckItem text="Landfill creates odour, pests, and pollution." />
                        <CheckItem text="Regulations change often and add extra work for your team." />
                    </div>
                </div>
            </div>
        </section>
    );
}
