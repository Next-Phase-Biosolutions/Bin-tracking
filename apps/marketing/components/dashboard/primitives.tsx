"use client";

import type { ReactNode } from "react";

/** A simulated UI window. `tone` switches between the light and dark chrome. */
export function Screen({
  title,
  badge,
  tone = "light",
  className = "",
  children,
}: {
  title: string;
  badge?: string;
  tone?: "light" | "dark";
  className?: string;
  children: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        dark
          ? "border-white/10 bg-[#2f3322] text-bone"
          : "border-edge bg-white text-ink shadow-panel"
      } ${className}`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
          dark ? "border-white/10 bg-black/15" : "border-edge/70 bg-bone-light/60"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-rust/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-olive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-edge" />
          </span>
          <span
            className={`font-mono text-[0.7rem] uppercase tracking-[0.16em] ${
              dark ? "text-bone/70" : "text-muted"
            }`}
          >
            {title}
          </span>
        </div>
        {badge && (
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-olive">
            <LiveDot />
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rust opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-rust" />
    </span>
  );
}

export function Bar({
  value,
  max = 100,
  tone = "olive",
  className = "",
}: {
  value: number;
  max?: number;
  tone?: "olive" | "rust" | "danger";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    tone === "rust"
      ? "bg-rust"
      : tone === "danger"
        ? "bg-[#c0532f]"
        : "bg-olive";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-edge/40 ${className}`}>
      <div
        className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatChip({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "rust";
}) {
  return (
    <div className="rounded-xl border border-edge/70 bg-bone-light/40 p-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-extrabold tabular-nums ${
          tone === "rust" ? "text-rust" : "text-olive-deep"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[0.68rem] text-muted">{hint}</p>}
    </div>
  );
}

export function Tag({
  children,
  tone = "olive",
}: {
  children: ReactNode;
  tone?: "olive" | "rust" | "muted" | "green";
}) {
  const map = {
    olive: "bg-olive/12 text-olive-deep",
    rust: "bg-rust/12 text-rust",
    muted: "bg-edge/30 text-muted",
    green: "bg-olive/15 text-olive",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-[0.1em] ${map}`}
    >
      {children}
    </span>
  );
}
