const imgTrustLocal = "/assets/imgTrustLocal.svg";
const imgGroup31 = "/assets/solutions/jacket.png";
const imgGroup1 = "/assets/solutions/meat.png";
const imgCuts = "/assets/solutions/cuts.png";
const imgDoc = "/assets/doc.png";

interface IconBadgeProps {
    badgeIcon: string;
    innerIcon?: string;
    text: string;
}

function IconBadge({ badgeIcon, innerIcon, text }: IconBadgeProps) {
    return (
        <div className="flex flex-col items-center gap-3 w-full sm:w-[250px]">
            <div className="relative w-[94px] h-[94px]">
                <img src={badgeIcon} alt="" className="w-full h-full object-contain" />
                {innerIcon && (
                    <img
                        src={innerIcon}
                        alt=""
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-auto object-contain"
                    />
                )}
            </div>
            <p
                className="font-normal text-lg md:text-[20px] text-black text-center leading-relaxed w-full sm:w-[192px] m-0"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
                {text}
            </p>
        </div>
    );
}

export function WhatWeHandle() {
    return (
        <section className="w-full bg-[#eef2e3] py-16 px-4 lg:py-[112px] lg:px-16 overflow-hidden">
            <div className="flex flex-col items-center gap-10 max-w-[1440px] mx-auto">
                <h2
                    className="font-bold text-3xl md:text-5xl lg:text-[48px] text-black text-center leading-tight tracking-tight max-w-[768px] w-full m-0"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                    What We Handle
                </h2>
                <div className="flex flex-row flex-wrap justify-center gap-8 lg:gap-10 w-full">
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgGroup31}
                        text="Hides and skins"
                    />
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgGroup1}
                        text="Fats and suet"
                    />
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgCuts}
                        text="Select off cuts and animal by products"
                    />
                    <IconBadge
                        badgeIcon={imgTrustLocal}
                        innerIcon={imgDoc}
                        text="Material types can be discussed with our team"
                    />
                </div>
            </div>
        </section>
    );
}

export default WhatWeHandle;
