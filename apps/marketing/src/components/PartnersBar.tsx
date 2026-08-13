import { Fragment } from "react";

const partners = [
  { src: "/logos/university-of-guelph.png", alt: "University of Guelph", imgClass: "max-h-9" },
  { src: "/logos/oci.png", alt: "OCI — Ontario Centre of Innovation", imgClass: "max-h-9" },
  // CMIT reads smaller than the two wide lockups, so it gets extra height.
  { src: "/logos/cmit.png", alt: "Centre for Meat Innovation & Technology", imgClass: "max-h-12" },
];

interface PartnersBarProps {
  /** left (hero): left on desktop, centered on mobile · center (footer): centered at every width */
  align?: "left" | "center";
  /** panel stretches full width with the logos spread across it (footer bar) */
  fill?: boolean;
  /** rust hairlines between logos (hidden when wrapped on mobile) */
  dividers?: boolean;
}

/**
 * "In partnership with" logos on a solid cream (bone-light) panel with a rust
 * hairline — reads clearly on the dark hero/footer. Logos are pre-processed
 * (trimmed, backgrounds keyed transparent) so they sit cleanly on the cream.
 */
export function PartnersBar({ align = "left", fill = false, dividers = false }: PartnersBarProps) {
  const colAlign = align === "center" ? "items-center" : "items-center sm:items-start";
  const rowJustify = fill
    ? "justify-around"
    : align === "center"
      ? "justify-center"
      : "justify-center sm:justify-start";
  const panelWidth = fill ? "w-full" : "max-w-full";

  return (
    <div className={`flex w-full flex-col gap-4 ${colAlign}`}>
      <span className="inline-flex items-center gap-2 rounded-full border border-bone/25 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-rust" />
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/85">
          In partnership with
        </span>
      </span>

      <div
        className={`flex ${panelWidth} flex-wrap items-center ${rowJustify} gap-x-8 gap-y-4 rounded-2xl border border-rust/40 bg-bone-light px-8 py-5 shadow-[0_20px_44px_-26px_rgba(0,0,0,0.5)]`}
      >
        {partners.map((p, i) => (
          <Fragment key={p.src}>
            {dividers && i > 0 && (
              <span aria-hidden className="hidden h-10 w-px self-center bg-rust/30 sm:block" />
            )}
            <img
              src={p.src}
              alt={p.alt}
              loading="lazy"
              className={`${p.imgClass} w-auto object-contain`}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
