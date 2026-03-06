import React from 'react';

const imgWhoWeAre = "/assets/aboutus/shed.png";

export function WhoWeAre() {
    return (
        <section className="bg-white py-16 lg:py-[100px] px-6 md:px-16 w-full">
            <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                {/* Image side */}
                <div className="w-full lg:w-1/2 flex justify-center">
                    <img
                        src={imgWhoWeAre}
                        alt="Who We Are - Barn"
                        className="w-full max-w-[600px] h-auto object-cover rounded-2xl shadow-sm"
                    />
                </div>

                {/* Text side */}
                <div className="w-full lg:w-1/2 flex flex-col gap-6">
                    <h2
                        className="font-bold text-3xl md:text-[40px] text-black leading-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Who We Are
                    </h2>
                    <p
                        className="font-normal text-base md:text-lg text-black leading-relaxed m-0"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Next Phase BioSolutions operates on a 500-acre active sheep farm in
                        the ongoing community. We aim to support exactly what happens inside
                        your farm operation, managing logistics safely, keeping regulatory
                        compliance in areas we can and treating resources with maximum benefits.
                    </p>
                </div>

            </div>
        </section>
    );
}

export default WhoWeAre;
