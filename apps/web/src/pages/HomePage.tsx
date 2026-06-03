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
    BlindsStage,
} from "../features/home/components";

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */

// Each panel fills a viewport and centres its section so the venetian-blind
// reveal shows the whole section through the opening bands.
const panel = (node: React.ReactNode) => <div className="blinds-screen">{node}</div>;

const homePanels: React.ReactNode[] = [
    panel(<Hero />),
    panel(<TrustFactors />),
    panel(<TheProblem />),
    panel(<OurSolution />),
    panel(<ProvenResults />),
    panel(<Partners />),
    panel(<CTA />),
];

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
            <BlindsStage panels={homePanels} />
            <Footer />
        </div>
    );
}

export default HomePage;
