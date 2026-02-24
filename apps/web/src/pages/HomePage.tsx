import {
    Navbar,
    Hero,
    TrustFactors,
    TheProblem,
    OurSolution,
    ProvenResults,
    Partners,
    CTA,
    Footer,
} from "../features/home/components";

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */
export function HomePage() {
    return (
        <div style={{ fontFamily: "'Open Sans', sans-serif" }}>
            {/* 
        This adds the fonts required by the original design directly.
        In production, it might be better to move this to index.html 
      */}
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans:wght@400;600&family=Inter:wght@400;600&display=swap"
                rel="stylesheet"
            />
            <Navbar />
            <Hero />
            <TrustFactors />
            <TheProblem />
            <OurSolution />
            <ProvenResults />
            <Partners />
            <CTA />
            <Footer />
        </div>
    );
}

export default HomePage;
