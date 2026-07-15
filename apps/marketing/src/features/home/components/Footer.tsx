import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';

const imgLogo = "/assets/greenlogo.png";

const socialLinks = [
  { icon: <Facebook size={20} />, label: "Facebook" },
  { icon: <Instagram size={20} />, label: "Instagram" },
  { icon: <Twitter size={20} />, label: "X" },
  { icon: <Linkedin size={20} />, label: "LinkedIn" },
  { icon: <Youtube size={20} />, label: "YouTube" },
];

const quickLinks = ["Home Page", "About Us", "Solutions", "Process"];

export function Footer() {
  return (
    <footer
      className="relative overflow-hidden py-16 px-5 md:py-20 md:px-16"
      style={{ background: '#030a06', borderTop: '1px solid rgba(18,205,128,0.12)' }}
    >
      {/* Decorative blob */}
      <div
        className="liquid-blob"
        style={{
          width: 500, height: 400,
          background: 'radial-gradient(circle, rgba(18,205,128,0.06), transparent 70%)',
          bottom: -150, left: -100,
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-24 mb-12">

          {/* Brand */}
          <div className="flex flex-col gap-5 lg:max-w-sm">
            <Link to="/">
              <img src={imgLogo} alt="Next Phase BioSolutions" className="h-12 object-contain object-left" />
            </Link>
            <p
              className="text-base leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Open Sans', sans-serif" }}
            >
              Turning abattoir by-products into useful materials. Safe, local, and compliant landfill diversion for the meat processing industry.
            </p>
            <div className="flex gap-3 mt-1">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 glass-card"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#12cd80')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links columns */}
          <div className="flex flex-col sm:flex-row gap-12 lg:gap-20">
            {/* Quick Links */}
            <div className="flex flex-col gap-4">
              <h4
                className="text-sm font-semibold tracking-widest uppercase"
                style={{ color: '#12cd80', fontFamily: "'Inter', sans-serif" }}
              >
                Navigation
              </h4>
              <div className="flex flex-col gap-2">
                {quickLinks.map((l) => (
                  <a
                    key={l}
                    href="#"
                    className="text-sm leading-relaxed transition-colors duration-200 no-underline"
                    style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Open Sans', sans-serif" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#12cd80')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-4">
              <h4
                className="text-sm font-semibold tracking-widest uppercase"
                style={{ color: '#12cd80', fontFamily: "'Inter', sans-serif" }}
              >
                Contact
              </h4>
              <div className="flex flex-col gap-2">
                {["Get in Touch", "Book an Audit", "Support"].map((l) => (
                  <a
                    key={l}
                    href="#"
                    className="text-sm leading-relaxed transition-colors duration-200 no-underline"
                    style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Open Sans', sans-serif" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#12cd80')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px mb-8" style={{ background: 'rgba(18,205,128,0.08)' }} />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p
            className="text-sm"
            style={{ color: 'rgba(255,255,255,0.32)', fontFamily: "'Open Sans', sans-serif" }}
          >
            © 2025 Next Phase BioSolutions. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-xs no-underline transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.32)', fontFamily: "'Open Sans', sans-serif" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#12cd80')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.32)')}
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
