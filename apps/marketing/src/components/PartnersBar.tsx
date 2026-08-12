const partners = [
  { src: "/logos/university-of-guelph.png", alt: "University of Guelph", imgClass: "max-h-9" },
  { src: "/logos/oci.png", alt: "OCI — Ontario Centre of Innovation", imgClass: "max-h-9" },
  // CMIT reads smaller than the two wide lockups, so it gets extra height.
  { src: "/logos/cmit.png", alt: "Centre for Meat Innovation & Technology", imgClass: "max-h-12" },
];

/**
 * "In partnership with" logos, shown inside the hero directly under the CTA.
 * Treatment: a solid warm bone-light (cream) panel with a thin rust hairline,
 * so it feels on-brand rather than a stark white card. The panel stays light
 * because the logos are dark artwork that needs a light backing to read; a
 * solid fill (no translucency) keeps the cream consistent over the hero video.
 */
export function PartnersBar() {
  return (
    <div className="flex flex-col items-start gap-4">
      <span className="inline-flex items-center gap-2 rounded-full border border-bone/25 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-rust" />
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/85">
          In partnership with
        </span>
      </span>

      <div className="flex max-w-full flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-rust/40 bg-bone-light px-7 py-5 shadow-[0_20px_44px_-26px_rgba(0,0,0,0.5)]">
        {partners.map((p) => (
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            loading="lazy"
            className={`${p.imgClass} w-auto object-contain`}
          />
        ))}
      </div>
    </div>
  );
}
