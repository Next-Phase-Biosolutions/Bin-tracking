const imgTrustLocal = "/assets/location.png";
const imgTrustLicensed = "/assets/trust.png";
const imgTrustTrace = "/assets/doc.png";
const imgTrustSetup = "/assets/bolt.png";
const imgTrustReduce = "/assets/recycle.png";

const trustItems = [
    { icon: imgTrustLocal, label: "Local Coverage up to 200 km" },
    { icon: imgTrustLicensed, label: "Licensed and Compliant Handling" },
    { icon: imgTrustTrace, label: "Traceability and Reporting" },
    { icon: imgTrustSetup, label: "Fast, Easy Site Setup." },
    { icon: imgTrustReduce, label: "Reduce Waste and Costs" },
];

export function TrustFactors() {
    return (
        <section className="bg-[#eef2e3] py-16 px-4 md:py-24 md:px-16 flex flex-col items-center overflow-hidden">
            <h2 className="font-bold text-3xl md:text-[48px] leading-tight tracking-tight text-black mb-10 text-center" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Our Trust Factors
            </h2>
            <div className="flex flex-wrap gap-8 md:gap-10 items-start justify-center max-w-7xl mx-auto">
                {trustItems.map((item) => (
                    <div
                        key={item.label}
                        className="flex flex-col items-center gap-3 w-40 md:w-48"
                    >
                        <div className="relative w-20 h-20 md:w-[94px] md:h-[94px] flex items-center justify-center">
                            {/* The SVG background */}
                            <img
                                src="/assets/imgTrustLocal.svg"
                                alt="Background"
                                className="absolute inset-0 w-full h-full"
                            />
                            {/* The foreground icon */}
                            <img
                                src={item.icon}
                                alt={item.label}
                                className="relative w-10 h-10 md:w-12 md:h-12 z-10 object-contain"
                            />
                        </div>
                        <p className="font-normal text-base md:text-[20px] leading-relaxed text-black text-center m-0" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                            {item.label}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
