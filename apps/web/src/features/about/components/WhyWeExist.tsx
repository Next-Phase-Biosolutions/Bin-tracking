import React from 'react';

const imgWhyWeExist = "/assets/aboutus/sheep.png";

export function WhyWeExist() {
    return (
        <section className="bg-white py-16 lg:py-[100px] px-6 md:px-16 w-full">
            <div className="max-w-[1280px] mx-auto flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">

                {/* Text side */}
                <div className="w-full lg:w-1/2 flex flex-col gap-6">
                    <h2
                        className="font-bold text-3xl md:text-[40px] text-black leading-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Why We Exist
                    </h2>
                    <p
                        className="font-normal text-base md:text-lg text-black leading-relaxed m-0"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Abattoirs and meat processors have historically had overlapping areas of
                        managing processing and capacity. Handling residuals is expensive and environmentally
                        taxing. We provide a guaranteed end to end safe and practical path that
                        effectively handles resources and turns what was once an issue into an
                        opportunity for a better, more sustainable ecology.
                    </p>
                </div>

                {/* Image side */}
                <div className="w-full lg:w-1/2 flex justify-center">
                    <img
                        src={imgWhyWeExist}
                        alt="Why We Exist - Sheep"
                        className="w-full max-w-[600px] h-auto object-cover rounded-2xl shadow-sm"
                    />
                </div>

            </div>
        </section>
    );
}

export default WhyWeExist;
