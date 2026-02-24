import { CheckItem } from "./CheckItem";

const imgSolution = "/assets/imgSolution.jpg";

export function OurSolution() {
    return (
        <section className="bg-[#f8f8f8] py-16 px-4 md:py-28 md:px-16 flex justify-center overflow-hidden">
            <div className="flex flex-col-reverse lg:flex-row gap-10 lg:gap-20 items-center max-w-7xl mx-auto w-full">
                {/* Content */}
                <div className="w-full lg:w-1/2 flex flex-col gap-6 lg:gap-8">
                    <h2
                        className="font-bold text-3xl md:text-[48px] leading-tight tracking-tight text-black m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        Our Solution
                    </h2>
                    <div className="flex flex-col gap-4">
                        <CheckItem text="We collect hides, skins, fats, and selected off cuts from your plant." />
                        <CheckItem text="We upcycle these materials into useful inputs such as collagen pathways, leather inputs, and bio oils." />
                        <CheckItem text="We provide clear monthly reports that show how much waste is diverted from landfill." />
                    </div>
                </div>

                {/* Image */}
                <div className="w-full lg:w-1/2 rounded-xl overflow-hidden flex-shrink-0 aspect-[3/2] lg:h-[400px]">
                    <img
                        src={imgSolution}
                        alt="Solution"
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>
        </section>
    );
}
