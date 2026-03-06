import React from 'react';

const imgHeroBg = "/assets/aboutus/about-hero.png";
const imgHeroBgMobile = "/assets/aboutus/mob-hero.png";

export function AboutHero() {
    return (
        <section className="relative w-full min-h-[500px] lg:min-h-[700px] bg-[#021f15] overflow-hidden">
            {/* Background image for mobile (hidden on medium screens and larger) */}
            <img
                src={imgHeroBgMobile}
                alt="About Hero Background (Mobile)"
                className="absolute inset-0 w-full h-full object-contain scale-[1.37] object-center opacity-80 md:hidden"
            />
            {/* Background image for desktop (hidden on mobile, visible on medium screens and larger) */}
            <img
                src={imgHeroBg}
                alt="About Hero Background (Desktop)"
                className="hidden md:block absolute inset-0 w-full h-full object-contain md:scale-[0.90] object-center opacity-80"
            />
            {/* Dark overlay slightly to make text pop */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[500px] lg:min-h-[700px] text-center px-4">
                <div className="flex flex-col items-center justify-center gap-8 max-w-[800px] w-full">
                    <h1
                        className="font-bold text-4xl md:text-5xl lg:text-[72px] text-white text-center leading-tight tracking-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        About Next Phase BioSolutions
                    </h1>
                </div>
            </div>
        </section>
    );
}

export default AboutHero;
