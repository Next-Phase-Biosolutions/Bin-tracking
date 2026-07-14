"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ---------- Card ---------- */
export function Card({
  children,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const Tag = as;
  return (
    <Tag className={`rounded-2xl border border-edge/70 bg-white shadow-card ${className}`}>
      {children}
    </Tag>
  );
}

/* ---------- Kicker (mono uppercase label) ---------- */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`kicker ${className}`}>{children}</p>;
}

/* ---------- Live status dot ---------- */
export function LiveDot({ tone = "live" }: { tone?: "live" | "rust" | "warn" | "muted" }) {
  const color =
    tone === "rust" ? "bg-rust" : tone === "warn" ? "bg-warn" : tone === "muted" ? "bg-muted" : "bg-live";
  return (
    <span className="relative flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} animate-ping-soft`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

/* ---------- Status badge ---------- */
const badgeStyles: Record<string, string> = {
  complete: "bg-olive-deep text-bone-light",
  active: "bg-live/15 text-live ring-1 ring-live/30",
  idle: "bg-edge/30 text-muted ring-1 ring-edge/50",
  pending: "bg-rust/12 text-rust ring-1 ring-rust/25",
  good: "bg-live/15 text-live ring-1 ring-live/30",
  warn: "bg-warn/15 text-warn ring-1 ring-warn/30",
  alert: "bg-rust/12 text-rust ring-1 ring-rust/25",
};
export function Badge({
  children,
  tone = "idle",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeStyles;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${badgeStyles[tone] ?? badgeStyles.idle} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- Stat card ---------- */
export function Stat({
  label,
  value,
  unit,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={`p-5 ${accent ? "ring-1 ring-rust/20" : ""}`}>
      <div className="flex items-start justify-between">
        <p className="kicker">{label}</p>
        {icon ? <span className="text-olive/70">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-[2rem] font-extrabold leading-none tracking-tight text-olive-deep tnum">
        {value}
        {unit ? <span className="ml-1 text-base font-bold text-muted">{unit}</span> : null}
      </p>
      {sub ? <div className="mt-2 text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}

/* ---------- Buttons ---------- */
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "rust";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-olive-deep text-bone-light hover:bg-olive-deep/90",
    rust: "bg-rust text-canvas hover:bg-rust/90",
    secondary: "border border-edge bg-white text-olive-deep hover:bg-bone-light",
    ghost: "text-muted hover:bg-bone-light hover:text-olive-deep",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Section header ---------- */
export function SectionHead({
  title,
  right,
  className = "",
}: {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="font-display text-lg font-bold text-olive-deep">{title}</h2>
      {right}
    </div>
  );
}

/* ---------- Reveal (scroll/route entrance) ---------- */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.21, 0.5, 0.27, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Progress bar ---------- */
export function Progress({ value, tone = "olive" }: { value: number; tone?: "olive" | "rust" }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-edge/40">
      <motion.div
        className={`h-full rounded-full ${tone === "rust" ? "bg-rust" : "bg-olive"}`}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}
