import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function Logo({
  variant = "dark",
  className = "",
  priority = false,
}: {
  variant?: "dark" | "light";
  className?: string;
  priority?: boolean;
}) {
  const src =
    variant === "light" ? "/NPB-Logo-light.png" : "/NPB-Logo-transparent.png";
  return (
    <img
      src={src}
      alt="Next Phase BioSolutions"
      width={1185}
      height={312}
      className={className}
    />
  );
}

export function Eyebrow({
  children,
  tone = "rust",
  className = "",
}: {
  children: ReactNode;
  tone?: "rust" | "bone" | "olive";
  className?: string;
}) {
  const color =
    tone === "rust"
      ? "text-rust"
      : tone === "bone"
        ? "text-bone"
        : "text-olive";
  return (
    <span className={`eyebrow inline-flex items-center gap-2.5 ${color} ${className}`}>
      <span aria-hidden className="h-px w-7 bg-current opacity-60" />
      {children}
    </span>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

export function CTAButton({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const base =
    "group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 will-change-transform";
  const styles = {
    primary:
      "bg-rust text-canvas shadow-[0_14px_30px_-12px_rgba(168,68,42,0.7)] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(168,68,42,0.75)]",
    secondary:
      "border border-edge bg-transparent text-olive-deep hover:border-olive-deep hover:bg-bone-light/60",
    ghost:
      "border border-bone/30 bg-white/5 text-bone hover:bg-white/10 hover:border-bone/60",
  }[variant];

  return (
    <Link to={href} className={`${base} ${styles} ${className}`}>
      {children}
      <ArrowRight />
    </Link>
  );
}

export function ArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="transition-transform duration-200 group-hover:translate-x-0.5"
    >
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
