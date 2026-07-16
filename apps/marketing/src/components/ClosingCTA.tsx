import { closing } from "@/data/content";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/atoms";
import { ContactForm } from "./ContactForm";

const proof = [
  "Find the money leaking on your cutting line",
  "Put a number on what your waste is worth",
  "Make an unannounced audit a non event",
];

export function ClosingCTA() {
  return (
    <section id="contact" className="relative scroll-mt-16 py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-50" />
      <div className="shell relative">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <Reveal>
              <Eyebrow>{closing.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-olive-deep sm:text-5xl">
                {closing.heading}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{closing.body}</p>
            </Reveal>
            <Reveal delay={0.15}>
              <ul className="mt-8 space-y-3">
                {proof.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-base text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-rust" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-8 text-sm text-muted">
                Prefer email?{" "}
                <a
                  href="mailto:info@nextphasebiosolutions.com"
                  className="font-medium text-rust underline-offset-4 hover:underline"
                >
                  info@nextphasebiosolutions.com
                </a>
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
