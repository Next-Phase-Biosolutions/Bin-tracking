import { Logo } from "./ui/atoms";

const cols = [
  {
    title: "Platform",
    links: [
      { label: "Overview", href: "#overview" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Five pillars", href: "#pillars" },
      { label: "One connected system", href: "#connected" },
    ],
  },
  {
    title: "The pillars",
    links: [
      { label: "Hardware", href: "#pillars" },
      { label: "AI", href: "#pillars" },
      { label: "Operations", href: "#pillars" },
      { label: "Compliance", href: "#pillars" },
      { label: "Recovery", href: "#pillars" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-olive-deep text-bone">
      <div className="shell py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo variant="light" className="h-9 w-auto" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-bone/70">
              The operating system for zero waste meat processing. Nothing
              wasted. One source of truth.
            </p>
            <a
              href="mailto:info@nextphasebiosolutions.com"
              className="mt-5 inline-block font-mono text-sm text-bone underline-offset-4 hover:text-rust hover:underline"
            >
              info@nextphasebiosolutions.com
            </a>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow text-bone/60">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-bone/80 transition-colors hover:text-rust"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-bone/15 pt-6 text-xs text-bone/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Next Phase BioSolutions. All rights
            reserved.
          </p>
          <p className="font-mono uppercase tracking-[0.18em]">
            Built for the whole animal
          </p>
        </div>
      </div>
    </footer>
  );
}
