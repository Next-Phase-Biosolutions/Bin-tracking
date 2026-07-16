
export function Logo({ variant = "light", className = "" }: { variant?: "light" | "dark"; className?: string }) {
  const src = variant === "light" ? "/NPB-Logo-light.png" : "/NPB-Logo-transparent.png";
  return (
    <img src={src} alt="Next Phase BioSolutions" width={1185} height={312} className={className} />
  );
}
