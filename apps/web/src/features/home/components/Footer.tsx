import { Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';

const imgFooterLogo = "/assets/greenlogo.png";
const imgDivider = "/assets/imgDivider.png";

const socialLinks = [
    { icon: <Facebook size={24} className="text-black" />, label: "Facebook" },
    { icon: <Instagram size={24} className="text-black" />, label: "Instagram" },
    { icon: <Twitter size={24} className="text-black" />, label: "X" },
    { icon: <Linkedin size={24} className="text-black" />, label: "LinkedIn" },
    { icon: <Youtube size={24} className="text-black" />, label: "YouTube" },
];

const quickLinks = ["Home Page", "About Us", "Shop page", "How it works"];

export function Footer() {
    return (
        <footer
            style={{
                backgroundColor: "white",
                borderTop: "1px solid #d0d0d0",
                padding: "80px 64px",
            }}
        >
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                <div
                    style={{
                        display: "flex",
                        gap: 128,
                        marginBottom: 80,
                    }}
                >
                    {/* Brand */}
                    <div style={{ width: 500, display: "flex", flexDirection: "column", gap: 24 }}>
                        <img src={imgFooterLogo} alt="Sheps Farm" style={{ height: 70, objectFit: "contain", alignSelf: "flex-start" }} />
                        <p
                            style={{
                                fontFamily: "'Open Sans', sans-serif",
                                fontWeight: 400,
                                fontSize: 18,
                                lineHeight: 1.5,
                                color: "black",
                                margin: 0,
                            }}
                        >
                            At Sheps Farm, we believe in real food, raised the right way — fresh, halal, and delivered to your door.
                        </p>
                    </div>

                    {/* Links */}
                    <div style={{ display: "flex", flex: 1, gap: 40, justifyContent: "flex-end" }}>
                        {/* Quick Links */}
                        <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 16 }}>
                            <p
                                style={{
                                    fontFamily: "'Open Sans', sans-serif",
                                    fontWeight: 600,
                                    fontSize: 18,
                                    lineHeight: 1.5,
                                    color: "black",
                                    margin: 0,
                                }}
                            >
                                Quick Links
                            </p>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {quickLinks.map((l) => (
                                    <a
                                        key={l}
                                        href="#"
                                        style={{
                                            display: "block",
                                            padding: "8px 0",
                                            fontFamily: "'Open Sans', sans-serif",
                                            fontWeight: 400,
                                            fontSize: 16,
                                            lineHeight: 1.5,
                                            color: "black",
                                            textDecoration: "none",
                                        }}
                                    >
                                        {l}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Social Media */}
                        <div style={{ width: 141, display: "flex", flexDirection: "column", gap: 16 }}>
                            <p
                                style={{
                                    fontFamily: "'Open Sans', sans-serif",
                                    fontWeight: 600,
                                    fontSize: 18,
                                    lineHeight: 1.5,
                                    color: "black",
                                    margin: 0,
                                }}
                            >
                                Social Media
                            </p>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {socialLinks.map((s) => (
                                    <a
                                        key={s.label}
                                        href="#"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: "8px 0",
                                            textDecoration: "none",
                                        }}
                                    >
                                        {/* Render the Lucide icon instead of an img tag */}
                                        {s.icon}
                                        <span
                                            style={{
                                                fontFamily: "'Open Sans', sans-serif",
                                                fontWeight: 400,
                                                fontSize: 16,
                                                lineHeight: 1.5,
                                                color: "black",
                                            }}
                                        >
                                            {s.label}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Divider + Copyright */}
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    <img src={imgDivider} alt="" style={{ width: "100%", height: 1 }} />
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            fontFamily: "'Open Sans', sans-serif",
                            fontWeight: 400,
                            fontSize: 16,
                            lineHeight: 1.5,
                            color: "black",
                        }}
                    >
                        <span>© 2025 Sheps Farm. All rights reserved.</span>
                        <div style={{ display: "flex", gap: 24 }}>
                            <a href="#" style={{ color: "black", textDecoration: "underline" }}>
                                Privacy Policy
                            </a>
                            <a href="#" style={{ color: "black", textDecoration: "underline" }}>
                                Terms of Service
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
