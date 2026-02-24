const results = [
    { stat: "22,000", desc: "Litres of fuel saved annually by reducing transport needs." },
    { stat: "8,000", desc: "Tonnes of waste diverted from landfill each year." },
    { stat: "$20k+", desc: "Average annual savings for medium sized abattoir clients." },
];

export function ProvenResults() {
    return (
        <section className="bg-[#043f2e] py-16 px-4 md:py-24 md:px-16 flex flex-col items-center">
            <h2
                className="font-bold text-3xl md:text-5xl leading-tight tracking-tight text-white mb-10 md:mb-16 text-center"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
                Proven Results
            </h2>

            <div className="flex flex-col md:flex-row flex-wrap gap-10 md:gap-20 items-center justify-center max-w-7xl mx-auto w-full">
                {results.map((r) => (
                    <div key={r.stat} className="w-full max-w-[326px] flex flex-col gap-3 md:gap-4 text-center md:text-left">
                        <h3
                            className="font-bold text-4xl md:text-6xl text-[#12cd80] m-0 tracking-tight"
                            style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                            {r.stat}
                        </h3>
                        <p
                            className="font-normal text-base md:text-[20px] leading-relaxed text-white m-0"
                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                            {r.desc}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
