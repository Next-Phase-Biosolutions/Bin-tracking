import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const imgLogo = "/assets/imgLogo.png";

export function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <nav className="bg-[#043F2E] px-4 py-4 md:px-16 md:py-5 relative">
            <div className="flex justify-between items-center max-w-7xl mx-auto">
                {/* Logo */}
                <div className="flex items-center">
                    <Link to="/">
                        <img
                            src={imgLogo}
                            alt="Sheps Farm"
                            className="h-10 md:h-[62px] object-contain"
                        />
                    </Link>
                </div>

                {/* Desktop Links */}
                <div className="hidden md:flex gap-8 items-center">
                    <div className="flex gap-6">
                        {["Home", "Solutions", "Process"].map((link) => {
                            let target = "#";
                            if (link === "Home") target = "/";
                            if (link === "Solutions") target = "/solutions";
                            if (link === "Process") target = "/process";

                            return (
                                <Link
                                    key={link}
                                    to={target}
                                    className="text-white hover:text-gray-200 transition-colors font-sans text-lg font-normal"
                                >
                                    {link}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="flex gap-4">
                        <a
                            href="#"
                            className="bg-[#3d5aa8] hover:bg-[#2d4280] text-white px-5 py-2 rounded-full font-sans text-lg font-semibold border border-[#3d5aa8] transition-colors"
                        >
                            Contact Us
                        </a>
                        <Link
                            to="/app/dashboard"
                            className="bg-white hover:bg-gray-100 text-[#043F2E] px-5 py-2 rounded-full font-sans text-lg font-semibold border border-white transition-colors"
                        >
                            Launch App
                        </Link>
                    </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-white focus:outline-none"
                    onClick={toggleMenu}
                    aria-label="Toggle mobile menu"
                >
                    {isMobileMenuOpen ? (
                        <X size={28} />
                    ) : (
                        <Menu size={28} />
                    )}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-[#043F2E] border-t border-white/10 p-4 flex flex-col gap-4 shadow-lg z-50">
                    <div className="flex flex-col gap-4">
                        {["Home", "Solutions", "Process"].map((link) => {
                            let target = "#";
                            if (link === "Home") target = "/";
                            if (link === "Solutions") target = "/solutions";
                            if (link === "Process") target = "/process";

                            return (
                                <Link
                                    key={link}
                                    to={target}
                                    className="text-white hover:text-gray-200 transition-colors font-sans text-lg font-normal block"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link}
                                </Link>
                            );
                        })}
                    </div>
                    <div className="pt-2 border-t border-white/10">
                        <a
                            href="#"
                            className="bg-[#3d5aa8] hover:bg-[#2d4280] text-white px-5 py-2 rounded-full font-sans text-lg font-semibold inline-block text-center w-full transition-colors mb-2"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Contact Us
                        </a>
                        <Link
                            to="/app/dashboard"
                            className="bg-white hover:bg-gray-100 text-[#043F2E] px-5 py-2 rounded-full font-sans text-lg font-semibold inline-block text-center w-full transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
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
