import React from 'react';

const imgNpDigitalKreativaStudio2 = "https://www.figma.com/api/mcp/asset/52f7a81e-08b0-490a-8584-6eadc5bb86a7";

export function CoverageArea() {
    return (
        <section className="w-full bg-white py-16 px-4 lg:py-[112px] lg:px-16 overflow-hidden">
            <div className="flex flex-col items-center gap-10 lg:gap-20 max-w-[1280px] mx-auto w-full">
                <div className="flex flex-col items-center gap-6 max-w-[768px] w-full">
                    <h2
                        className="font-bold text-4xl md:text-5xl lg:text-[60px] text-black text-center leading-tight tracking-tight m-0"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
                        Coverage Area
                    </h2>
                    <p
                        className="font-normal text-lg lg:text-[18px] text-black text-center leading-relaxed m-0"
                        style={{ fontFamily: "'Open Sans', sans-serif" }}
                    >
                        We serve up to 200 km around Scugog, Ontario.<br />
                        Call us if your plant is outside the area.
                    </p>
                </div>
                <div className="w-full max-w-[1280px] h-[300px] md:h-[450px] overflow-hidden">
                    <img
                        src={imgNpDigitalKreativaStudio2}
                        alt="Coverage Map"
                        className="w-full h-full object-cover object-center"
                    />
                </div>
            </div>
        </section>
    );
}

export default CoverageArea;
