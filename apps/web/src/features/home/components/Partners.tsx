const partners = [
    { img: "/assets/partner1.png", alt: "EcoWaste" },
    { img: "/assets/partner2.png", alt: "GreenEnergy" },
    { img: "/assets/partner3.png", alt: "PureSolutions" },
];

export function Partners() {
    return (
        <section className="bg-[#eef2e3] py-16 px-4 md:py-24 md:px-16 flex flex-col items-center">
            <h2
                className="font-bold text-3xl md:text-[48px] leading-tight tracking-tight text-[#043f2e] mb-10 md:mb-16 text-center max-w-[800px]"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
                Trusted by thousands of businesses worldwide.
            </h2>
            <div className="flex justify-center items-center gap-8 md:gap-20 lg:gap-[120px] flex-wrap max-w-7xl mx-auto w-full">
                {partners.map((p, i) => (
                    <img
                        key={i}
                        src={p.img}
                        alt={p.alt}
                        className="h-10 md:h-14 lg:h-[60px] w-auto object-contain"
                    />
                ))}
            </div>
        </section>
    );
}
