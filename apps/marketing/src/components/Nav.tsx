
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "./ui/atoms";

const links = [
  { label: "Overview", href: "#overview" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Five pillars", href: "#pillars" },
  { label: "One system", href: "#connected" },
];

// Login portal for the application. Points to the in-site /login page for now;
// repoint to the real app URL when the demo application ships.
const LOGIN_URL = "/login";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || open;
  const light = !solid; // light styling while sitting over the dark hero

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "border-b border-edge/70 bg-canvas/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="shell flex h-16 items-center justify-between md:h-20">
        <a href="#top" className="flex items-center" aria-label="Next Phase BioSolutions home">
          <Logo priority variant={light ? "light" : "dark"} className="h-7 w-auto md:h-8" />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                light ? "text-bone/80 hover:text-bone" : "text-muted hover:text-olive-deep"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={LOGIN_URL}
            className={`inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${
              light
                ? "border-bone/40 text-bone hover:bg-white/10"
                : "border-edge text-olive-deep hover:bg-bone-light"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M6.5 2H12a1 1 0 011 1v10a1 1 0 01-1 1H6.5M8.5 8H2m0 0l2.5-2.5M2 8l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Login
          </a>
          <a
            href="#contact"
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              light
                ? "bg-rust text-canvas hover:bg-rust/90"
                : "bg-olive-deep text-canvas hover:bg-rust"
            }`}
          >
            Contact Sales
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex h-10 w-10 items-center justify-center rounded-full border md:hidden ${
            light ? "border-bone/40 text-bone" : "border-edge text-olive-deep"
          }`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <div className="flex flex-col gap-[5px]">
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`}
            />
            <span className={`block h-0.5 w-5 bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
            />
          </div>
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-edge/60 bg-canvas md:hidden"
          >
            <div className="shell flex flex-col gap-1 py-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-olive-deep hover:bg-bone-light"
                >
                  {link.label}
                </a>
              ))}
              <a
                href={LOGIN_URL}
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full border border-edge px-5 py-3 text-center text-sm font-semibold text-olive-deep hover:bg-bone-light"
              >
                Login
              </a>
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-full bg-rust px-5 py-3 text-center text-sm font-semibold text-canvas"
              >
                Contact Sales
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
