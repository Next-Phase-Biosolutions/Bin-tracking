import { Link } from 'react-router-dom';

const imgLogo = "/assets/imgLogo.png";

export function Navbar() {
    return (
        <nav
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 64px",
                backgroundColor: "#043F2E",
            }}
        >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center" }}>
                <Link to="/">
                    <img
                        src={imgLogo}
                        alt="Sheps Farm"
                        style={{ height: 62, objectFit: "contain" }}
                    />
                </Link>
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 24 }}>
                    {["Home", "Solutions", "Process"].map((link) => {
                        let target = "#";
                        if (link === "Home") target = "/";
                        if (link === "Solutions") target = "/solutions";
                        if (link === "Process") target = "/process";

                        return (
                            <Link
                                key={link}
                                to={target}
                                style={{
                                    textDecoration: "none",
                                    color: "white",
                                    fontFamily: "'Open Sans', sans-serif",
                                    fontWeight: 400,
                                    fontSize: 18,
                                    lineHeight: 1.5,
                                }}
                            >
                                {link}
                            </Link>
                        );
                    })}
                </div>

                <div style={{ display: "flex", gap: 16 }}>
                    <a
                        href="#"
                        style={{
                            backgroundColor: "#3d5aa8",
                            color: "white",
                            padding: "8px 20px",
                            borderRadius: 100,
                            textDecoration: "none",
                            fontFamily: "'Open Sans', sans-serif",
                            fontSize: 18,
                            fontWeight: 600,
                            lineHeight: 1.5,
                            border: "1px solid #3d5aa8",
                        }}
                    >
                        Contact Us
                    </a>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
