import { Navbar, Footer } from "../features/home/components";
import { ProcessHero } from "../features/process/components/ProcessHero";
import { ProcessSteps } from "../features/process/components/ProcessSteps";
import { ProcessCTA } from "../features/process/components/ProcessCTA";

export function ProcessPage() {
    return (
        <div style={{ fontFamily: "'Open Sans', sans-serif" }}>
            <Navbar />
            <ProcessHero />
            <ProcessSteps />
            <ProcessCTA />
            <Footer />
        </div>
    );
}

export default ProcessPage;
