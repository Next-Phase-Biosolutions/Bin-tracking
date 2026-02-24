const imgTrustLocal = "/assets/imgTrustLocal.svg";
const imgGroup31 = "https://www.figma.com/api/mcp/asset/6840897c-717a-4d41-96f7-b8187d2df8a4";
const imgGroup1 = "https://www.figma.com/api/mcp/asset/170fbf22-6ece-4112-a337-23e860869341";
const imgCuts = "/assets/solutions/cuts.png";
const imgJacket = "/assets/solutions/jacket.png";

interface IconBadgeProps {
    badgeIcon: string;
    innerIcon?: string;
    text: string;
}

function IconBadge({ badgeIcon, innerIcon, text }: IconBadgeProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 250 }}>
            <div style={{ position: "relative", width: 94, height: 94 }}>
                <img src={badgeIcon} alt="" style={{ width: "100%", height: "100%" }} />
                {innerIcon && (
                    <img
                        src={innerIcon}
                        alt=""
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: 44,
                            height: "auto",
                        }}
                    />
                )}
            </div>
            <p
                style={{
                    fontFamily: "'Open Sans', sans-serif",
                    fontSize: 20,
                    color: "black",
                    textAlign: "center",
                    lineHeight: 1.5,
                    width: 192,
                    margin: 0,
                }}
            >
                {text}
            </p>
        </div>
    );
}

export function WhatWeHandle() {
    return (
        <section
            style={{
                width: "100%",
                backgroundColor: "#eef2e3",
                padding: "112px 64px",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 40,
                    maxWidth: 1440,
                    margin: "0 auto",
                }}
            >
                <h2
                    style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 700,
                        fontSize: 48,
                        color: "black",
                        textAlign: "center",
                        letterSpacing: "-0.48px",
                        lineHeight: 1.2,
                        width: 768,
                        margin: 0,
                    }}
                >
                    What We Handle
                </h2>
                <div style={{ display: "flex", gap: 40 }}>
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgGroup31}
                        text="Hides and skins"
                    />
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgGroup1}
                        text="Fats and suet"
                    />
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgCuts}
                        text="Select off cuts and animal by products"
                    />
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgJacket}
                        text="Material types can be discussed with our team"
                    />
                </div>
            </div>
        </section>
    );
}

export default WhatWeHandle;
