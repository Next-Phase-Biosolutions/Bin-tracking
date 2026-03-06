import { Navbar, Footer } from "../features/home/components";
import {
    AboutHero,
    WhoWeAre,
    WhyWeExist,
    HowWereDifferent,
    ComplianceAndSafety,
    ServiceArea,
    AboutCTA
} from "../features/about/components";

export function AboutPage() {
    return (
        <div style={{ fontFamily: "'Open Sans', sans-serif" }}>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans:wght@400;500&family=Inter:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <Navbar />
            <AboutHero />
            <WhoWeAre />
            <WhyWeExist />
            <HowWereDifferent />
            <ComplianceAndSafety />
            <ServiceArea />
            <AboutCTA />
            <Footer />
        </div>
    );
}

export default AboutPage;
