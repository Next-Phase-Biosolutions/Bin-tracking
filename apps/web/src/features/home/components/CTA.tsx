const imgCtaOverlay = "/assets/imgCtaOverlay.png";

export function CTA() {
    return (
        <section className="relative min-h-[400px] lg:min-h-[522px] overflow-hidden bg-[#f1ede2] flex items-center justify-center py-16 px-4">
            {/* Background image overlay */}
            <div className="absolute inset-0 z-0">
                <img
                    src={imgCtaOverlay}
                    alt=""
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Black transparent filter */}
            <div className="absolute inset-0 bg-black/60 z-0" />

            {/* Content box */}
            <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center max-w-[768px]">
                <h2
                    className="font-bold text-3xl md:text-5xl lg:text-[48px] leading-tight tracking-tight text-white m-0"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                    Start Turning Your By Products into Value
                </h2>
                <p
                    className="font-normal text-lg md:text-[22px] leading-relaxed text-white m-0 mb-2 md:px-0"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                >
                    Get a clear transparent proposal that shows exactly how we can divert your organic waste and save you money.
                </p>
                <div className="flex gap-4">
                    <button
                        className="bg-[#12cd80] hover:bg-[#0fa668] text-[#01140e] border-none rounded-full px-6 py-3 font-semibold text-lg md:text-[20px] cursor-pointer transition-colors"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Contact Us Today
                    </button>
                    <button
                        className="bg-transparent text-white border border-white hover:bg-white/10 rounded-full px-6 py-3 font-semibold text-lg md:text-[20px] cursor-pointer transition-colors"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Our Process
                    </button>
                </div>
            </div>
        </section>
    );
}
