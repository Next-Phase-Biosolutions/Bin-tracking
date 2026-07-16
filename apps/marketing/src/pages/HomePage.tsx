import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Overview } from "@/components/Overview";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { Pillars } from "@/components/Pillars";
import { ConnectedSystem } from "@/components/ConnectedSystem";
import { ClosingCTA } from "@/components/ClosingCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Overview />
      <Problem />
      <HowItWorks />
      <Pillars />
      <ConnectedSystem />
      <ClosingCTA />
      <Footer />
    </main>
  );
}
