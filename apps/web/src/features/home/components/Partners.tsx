const partners = [
    { img: "/assets/imgPartner1.png", alt: "EcoWaste", size: "w-32 md:w-40 lg:w-48" },
    { img: "/assets/imgPartner2.png", alt: "GreenEnergy", size: "w-32 md:w-32 lg:w-48 pt-4 md:pt-6 lg:pt-25" },
    { img: "/assets/imgPartner3.png", alt: "PureSolutions", size: "w-28 md:w-36 lg:w-44" },
    { img: "/assets/imgPartner4.png", alt: "Partner 4", size: "w-32 md:w-28 lg:w-48" },
];

export function Partners() {
    return (
        <section className="bg-[#eef2e3] py-8 px-4 md:py-12 md:px-16 flex flex-col items-center">
            <h2
                className="font-bold text-3xl md:text-[40px] leading-tight tracking-tight text-[#043f2e] mb-6 md:mb-8 text-center max-w-[800px]"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
                Supported By
            </h2>
            <div className="flex justify-center items-center gap-8 md:gap-20 lg:gap-[120px] flex-wrap max-w-7xl mx-auto w-full">
                {partners.map((p, i) => (
                    <img
                        key={i}
                        src={p.img}
                        alt={p.alt}
                        className={`${p.size} h-auto object-contain`}
                    />
                ))}
            </div>
        </section>
    );
}
