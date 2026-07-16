
import type { ReactNode } from "react";

/* Brand recreation of the "Journey of Emissions Data" infographic
   (source: m1_customer_story_visual-3.html), on a light surface to match
   the app screenshots, with earthy brand colored gas particles. */

const OLIVE_DEEP = "#3A3F2A";
const RUST = "#A8442A";

const gases = [
  { sym: "CH₄", color: "#A8442A", lane: -14, tagAbove: true, delay: "0s" },
  { sym: "H₂S", color: "#6B7350", lane: -7, tagAbove: true, delay: "0.4s" },
  { sym: "NH₃", color: "#3A3F2A", lane: 0, tagAbove: true, delay: "0.8s" },
  { sym: "CO", color: "#7A7259", lane: 7, tagAbove: false, delay: "1.2s" },
  { sym: "CO₂", color: "#94703F", lane: 14, tagAbove: false, delay: "1.6s" },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 44" width="48" height="44" fill="none" className="shrink-0">
      {children}
    </svg>
  );
}

const icons = [
  // 1 — hazardous gases in the air
  <Icon key="g">
    <ellipse cx="24" cy="38" rx="17" ry="3.5" fill="#DDD3C0" />
    <path d="M14 38 Q14 22 18 17 Q14 13 16 8" stroke={OLIVE_DEEP} strokeWidth="2" strokeLinecap="round" />
    <path d="M34 38 Q34 22 30 17 Q34 13 32 8" stroke={OLIVE_DEEP} strokeWidth="2" strokeLinecap="round" />
    <circle cx="17" cy="6" r="3" fill={RUST} />
    <circle cx="33" cy="6" r="3" fill={RUST} opacity="0.7" />
    <path d="M17 38 Q24 27 31 38" stroke={OLIVE_DEEP} strokeWidth="1.4" strokeDasharray="2 3" opacity="0.5" />
  </Icon>,
  // 2 — sensor probe
  <Icon key="p">
    <rect x="20" y="6" width="8" height="26" rx="4" fill="#fff" stroke={OLIVE_DEEP} strokeWidth="2" />
    <ellipse cx="24" cy="33" rx="4" ry="2.4" fill={RUST} />
    <ellipse cx="24" cy="39" rx="15" ry="2.6" fill="#DDD3C0" />
    <path d="M13 14 Q9 10 12 6" stroke={OLIVE_DEEP} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    <path d="M35 14 Q39 10 36 6" stroke={OLIVE_DEEP} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
  </Icon>,
  // 3 — measuring device
  <Icon key="d">
    <path d="M24 6 v6" stroke={OLIVE_DEEP} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="24" cy="5" r="2" fill={OLIVE_DEEP} />
    <rect x="9" y="12" width="30" height="22" rx="4" fill="#fff" stroke={OLIVE_DEEP} strokeWidth="2" />
    <circle cx="16" cy="19" r="2.6" fill={OLIVE_DEEP} />
    <circle cx="24" cy="19" r="2.6" fill={RUST} />
    <circle cx="32" cy="19" r="2.6" fill={OLIVE_DEEP} />
    <circle cx="20" cy="27" r="2.6" fill={RUST} />
    <circle cx="28" cy="27" r="2.6" fill={OLIVE_DEEP} />
  </Icon>,
  // 4 — data sent and locked
  <Icon key="c">
    <ellipse cx="24" cy="24" rx="16" ry="9" fill="#fff" stroke={OLIVE_DEEP} strokeWidth="2" />
    <ellipse cx="14" cy="23" rx="7.5" ry="6" fill="#fff" stroke={OLIVE_DEEP} strokeWidth="2" />
    <ellipse cx="34" cy="23" rx="7.5" ry="6" fill="#fff" stroke={OLIVE_DEEP} strokeWidth="2" />
    <rect x="20" y="21" width="8" height="7" rx="1.5" fill={RUST} />
    <path d="M21 21 Q21 16 24 16 Q27 16 27 21" stroke={RUST} strokeWidth="1.8" fill="none" />
  </Icon>,
  // 5 — audit ready document + seal
  <Icon key="r">
    <rect x="10" y="7" width="22" height="30" rx="2.5" fill="#fff" stroke={OLIVE_DEEP} strokeWidth="2" />
    <line x1="14" y1="15" x2="28" y2="15" stroke="#C2B9A3" strokeWidth="2" />
    <line x1="14" y1="20" x2="28" y2="20" stroke="#C2B9A3" strokeWidth="2" />
    <line x1="14" y1="25" x2="24" y2="25" stroke="#C2B9A3" strokeWidth="2" />
    <circle cx="33" cy="30" r="9" fill={RUST} />
    <text x="33" y="34" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FAF8F3" fontFamily="var(--font-display)">$</text>
  </Icon>,
];

const nodes = [
  { label: "Hazardous gases in the air", sub: "released by plant operations" },
  { label: "A sensor probe picks it up", sub: "placed right at the source" },
  { label: "A device measures exact levels", sub: "checks every gas, every few seconds" },
  { label: "Data is sent and locked safely", sub: "no one can edit it later" },
  { label: "Ready for audit and reporting", sub: "compliance and carbon credits" },
];

export function EmissionsJourney() {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-canvas px-4 py-4">
      <p className="text-center font-mono text-[0.58rem] font-medium uppercase tracking-[0.12em] text-olive">
        The journey of emissions data
      </p>

      <div className="relative flex items-start justify-between px-1">
        {/* connecting rail through the icon centre line (icon ~44px tall) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-[9%] right-[9%]"
          style={{ top: 21, height: 2 }}
          preserveAspectRatio="none"
          viewBox="0 0 100 2"
        >
          <line className="flow-line" x1="0" y1="1" x2="100" y2="1" stroke={RUST} strokeWidth="1.6" />
        </svg>

        {/* traveling gas particles */}
        <div aria-hidden className="pointer-events-none absolute left-0 right-0" style={{ top: 21, height: 0 }}>
          {gases.map((g) => (
            <span
              key={g.sym}
              className="gas-particle absolute flex h-2 w-2 items-center justify-center rounded-full"
              style={{
                top: g.lane,
                background: g.color,
                boxShadow: `0 0 0 2.5px ${g.color}22, 0 0 7px ${g.color}55`,
                animationDelay: g.delay,
              }}
            >
              <span
                className="absolute whitespace-nowrap rounded px-1 font-mono text-[0.46rem] font-bold leading-tight text-canvas"
                style={{ background: g.color, [g.tagAbove ? "bottom" : "top"]: "9px" }}
              >
                {g.sym}
              </span>
            </span>
          ))}
        </div>

        {nodes.map((n, i) => (
          <div key={n.label} className="relative z-10 flex w-[19%] flex-col items-center text-center">
            {icons[i]}
            <p className="mt-2.5 text-[0.62rem] font-bold leading-tight text-olive-deep">{n.label}</p>
            <p className="mt-0.5 text-[0.55rem] leading-tight text-muted">{n.sub}</p>
          </div>
        ))}
      </div>

      <p className="text-center font-mono text-[0.55rem] text-muted">
        All 5 hazardous gases travel the same path, measured continuously, side by side.
      </p>
    </div>
  );
}
