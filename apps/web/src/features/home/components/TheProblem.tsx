import { CheckItem } from "./CheckItem";

const imgProblem = "/assets/imgProblem.jpg";

export function TheProblem() {
    return (
        <section className="bg-white py-16 px-4 md:py-28 md:px-16 flex justify-center overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-center max-w-7xl mx-auto w-full">
                {/* Image */}
                <div className="w-full lg:w-1/2 rounded-xl overflow-hidden flex-shrink-0 aspect-[3/2] lg:h-[400px]">
                    <img
                        src={imgProblem}
                        alt="Problem"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Content */}
                <div className="w-full lg:w-1/2 flex flex-col gap-6 lg:gap-8">
                    <h2
                        className="font-bold text-3xl md:text-[48px] leading-tight tracking-tight text-black m-0"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                        The Problem
                    </h2>
                    <div className="flex flex-col gap-4">
                        <CheckItem text="Disposal is expensive and risky." />
                        <CheckItem text="Landfill creates odour, pests, and pollution." />
                        <CheckItem text="Regulations change often and add extra work for your team." />
                    </div>
                </div>
            </div>
        </section>
    );
}
