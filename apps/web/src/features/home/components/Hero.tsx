const imgHeroOverlay = "/assets/imgHeroOverlay.png";
const imgHeroVector = "/assets/imgHeroVector.png";

export function Hero() {
    return (
        <section className="relative min-h-[500px] lg:min-h-[800px] overflow-hidden bg-transparent flex flex-col justify-center">
            {/* Background images */}
            <img
                src={imgHeroOverlay}
                alt=""
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <img
                src={imgHeroVector}
                alt=""
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] md:w-[101.5%] pointer-events-none object-cover"
            />

            {/* Light black film overlay */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center pt-16 md:pt-24 px-4 text-center">
                <div className="max-w-[768px]">
                    <h1
                        className="font-bold text-4xl md:text-6xl lg:text-[68px] leading-tight tracking-tight text-white mb-6"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Zero Waste Solutions for Abattoirs
                    </h1>
                    <p
                        className="font-normal text-lg md:text-[22px] leading-relaxed text-white mb-6 px-2 md:px-0"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        We turn by products that usually go to landfill into useful materials. Safe, local, and compliant.
                    </p>
                    <button
                        className="bg-[#043f2e] hover:bg-[#032a1f] text-white border-none rounded-full px-8 py-3.5 font-semibold text-lg md:text-[20px] cursor-pointer transition-colors"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Book a Zero Waste
                    </button>
                </div>
            </div>
        </section>
    );
}
