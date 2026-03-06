import React from 'react';

const imgMap = "/assets/aboutus/map.png";

export function ServiceArea() {
    return (
        <section className="bg-white py-16 lg:py-[100px] px-6 md:px-16 w-full">
            <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-8 lg:gap-12">

                <div className="flex flex-col items-center gap-4 text-center">
                    <h2
                        className="font-bold text-3xl md:text-[40px] text-black leading-tight m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Service Area
                    </h2>
                    <p
                        className="font-normal text-base md:text-lg text-black/80 leading-relaxed m-0"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        2910 highway 7a scugog, ontario l0b1b0, Canada
                    </p>
                </div>

                {/* Map Container */}
                <div className="w-full h-[400px] lg:h-[600px] border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* In a real scenario, this could be an iframe or a mapping library component. For now, an image placeholder based on the design. */}
                    <img
                        src={imgMap}
                        alt="Service Area Map"
                        className="w-full h-full object-cover grayscale-[20%] opacity-80"
                    />
                </div>

            </div>
        </section>
    );
}

export default ServiceArea;
