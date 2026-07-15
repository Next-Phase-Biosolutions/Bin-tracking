import type { SVGProps } from "react";

/* Lightweight inline icon set (stroke-based, currentColor) used across the app. */
type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconGrid = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconTruck = (p: P) => (
  <svg {...base(p)}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
);
export const IconBlade = (p: P) => (
  <svg {...base(p)}><path d="M4 14l9-9 3 3-9 9z" /><path d="M14 4l6 6" /><circle cx="6" cy="18" r="2" /></svg>
);
export const IconKnife = (p: P) => (
  <svg {...base(p)}><path d="M3 17l11-11c2-2 5-2 5 1 0 2-2 3-4 5l-4 4" /><path d="M3 17l4 4" /></svg>
);
export const IconSnow = (p: P) => (
  <svg {...base(p)}><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" /></svg>
);
export const IconBox = (p: P) => (
  <svg {...base(p)}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>
);
export const IconShip = (p: P) => (
  <svg {...base(p)}><path d="M4 10h16l-1.5 7H5.5zM12 3v7M8 6h8" /></svg>
);
export const IconBin = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
);
export const IconForm = (p: P) => (
  <svg {...base(p)}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
);
export const IconScan = (p: P) => (
  <svg {...base(p)}><path d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3M4 12h16" /></svg>
);
export const IconBadge = (p: P) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="9" r="2.4" /><path d="M8 16c.8-2 2.2-3 4-3s3.2 1 4 3" /></svg>
);
export const IconCow = (p: P) => (
  <svg {...base(p)}><path d="M5 7c0 3 3 5 7 5s7-2 7-5M5 7l-2-2M19 7l2-2M8 12v4a4 4 0 008 0v-4" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 010 6M21 20c0-2.4-1.5-4.2-3.6-4.8" /></svg>
);
export const IconMic = (p: P) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
);
export const IconChain = (p: P) => (
  <svg {...base(p)}><path d="M9 12a3 3 0 013-3h3a3 3 0 010 6h-1.5M15 12a3 3 0 01-3 3H9a3 3 0 010-6h1.5" /></svg>
);
export const IconThermo = (p: P) => (
  <svg {...base(p)}><path d="M12 14V4a2 2 0 014 0v10a4 4 0 11-4 0z" transform="translate(-2 0)" /></svg>
);
export const IconDrop = (p: P) => (
  <svg {...base(p)}><path d="M12 3s6 6.5 6 10.5A6 6 0 016 13.5C6 9.5 12 3 12 3z" /></svg>
);
export const IconGas = (p: P) => (
  <svg {...base(p)}><circle cx="8" cy="14" r="3" /><circle cx="15" cy="9" r="2.2" /><circle cx="16" cy="16" r="1.6" /></svg>
);
export const IconBolt = (p: P) => (
  <svg {...base(p)}><path d="M13 3L4 14h6l-1 7 9-11h-6z" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="M5 12l4.5 4.5L19 7" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base(p)}><path d="M4 9a8 8 0 0114-3l2 2M20 15a8 8 0 01-14 3l-2-2M18 4v4h-4M6 20v-4h4" /></svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
);
export const IconLeaf = (p: P) => (
  <svg {...base(p)}><path d="M5 19c0-8 6-13 14-13 0 8-6 13-14 13zM5 19c2-5 5-7 9-8" /></svg>
);
export const IconLogout = (p: P) => (
  <svg {...base(p)}><path d="M14 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M9 12h11M16 8l4 4-4 4" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
);
