import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const imgLogo = "/assets/imgLogo.png";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Solutions", to: "/solutions" },
  { label: "Process", to: "/process" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <nav
      className="sticky top-0 z-50 transition-all duration-300 glass-nav"
      style={{
        background: scrolled
          ? 'rgba(3, 8, 5, 0.92)'
          : 'rgba(4, 10, 7, 0.75)',
        boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-4 md:py-5 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center flex-shrink-0">
          <img src={imgLogo} alt="Next Phase BioSolutions" className="h-9 md:h-14 object-contain" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex gap-7">
            {navLinks.map(({ label, to }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={label}
                  to={to}
                  className="relative text-base font-medium transition-colors duration-200"
                  style={{
                    color: active ? '#12cd80' : 'rgba(255,255,255,0.82)',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute -bottom-1 left-0 right-0 h-px"
                      style={{ background: 'linear-gradient(90deg, #12cd80, transparent)' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex gap-3 ml-2">
            <a
              href="#"
              className="btn-glass px-5 py-2.5 text-sm font-semibold rounded-full"
            >
              Contact Us
            </a>
            <Link
              to="/app/dashboard"
              className="btn-glow px-5 py-2.5 text-sm font-bold rounded-full"
            >
              Launch App
            </Link>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(18,205,128,0.08)' }}
          onClick={() => setMobileOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden border-t flex flex-col gap-1 px-5 py-4"
          style={{
            background: 'rgba(3, 10, 6, 0.97)',
            borderColor: 'rgba(18, 205, 128, 0.12)',
          }}
        >
          {navLinks.map(({ label, to }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={label}
                to={to}
                className="py-3 px-3 rounded-xl text-base font-medium transition-colors"
                style={{
                  color: active ? '#12cd80' : 'rgba(255,255,255,0.8)',
                  background: active ? 'rgba(18,205,128,0.08)' : 'transparent',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {label}
              </Link>
            );
          })}
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(18,205,128,0.1)' }}>
            <a href="#" className="btn-glass py-3 text-sm font-semibold text-center rounded-full">
              Contact Us
            </a>
            <Link
              to="/app/dashboard"
              className="btn-glow py-3 text-sm font-bold text-center rounded-full"
            >
              Launch App
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
