import { Navbar, Footer } from "../features/home/components";
import {
    SolutionsHero,
    WhatWeHandle,
    WhatYouGet,
    ProgramOptions,
    CoverageArea,
    SolutionsCTA,
} from "../features/solutions/components";

export function SolutionsPage() {
    return (
        <div style={{ fontFamily: "'Open Sans', sans-serif" }}>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans:wght@400;600&family=Inter:wght@400;600&family=Outfit:wght@700&display=swap"
                rel="stylesheet"
            />
            <Navbar />
            <SolutionsHero />
            <WhatWeHandle />
            <WhatYouGet />
            <ProgramOptions />
            <CoverageArea />
            <SolutionsCTA />
            <Footer />
        </div>
    );
}

export default SolutionsPage;
