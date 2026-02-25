const imgCloseUpCobblerUsingSewingMachine = "https://www.figma.com/api/mcp/asset/49eafe8f-73e0-4f8a-bc27-bf38de4474b4";

export function SolutionsHero() {
    return (
        <section className="relative w-full min-h-[500px] lg:min-h-[800px] bg-transparent overflow-hidden">
            {/* Background image */}
            <img
                src={imgCloseUpCobblerUsingSewingMachine}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Content */}
            <div className="relative z-10 flex flex-col items-center pt-16 lg:pt-[92px] text-center px-4">
                <div className="flex flex-col items-center gap-6 max-w-[768px] w-full">
                    <h1
                        className="font-bold text-4xl md:text-5xl lg:text-[68px] text-white text-center leading-tight tracking-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        The Zero Waste Program for Abattoirs
                    </h1>
                    <p
                        className="font-normal text-lg md:text-[22px] text-white text-center leading-relaxed m-0"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        A simple, closed loop system that turns your by products into value while reducing risk and landfill waste.
                    </p>
                    <button
                        className="bg-[#043f2e] hover:bg-[#032a1f] text-white font-semibold text-lg md:text-[20px] px-6 py-3 lg:px-[30px] lg:py-[15px] rounded-full border-none cursor-pointer transition-colors"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Request a Zero Waste Audit
                    </button>
                </div>
            </div>
        </section>
    );
}

export default SolutionsHero;
