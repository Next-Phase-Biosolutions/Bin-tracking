import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';

const imgLogo = "/assets/greenlogo.png";

const socialLinks = [
    { icon: <Facebook size={24} className="text-black" />, label: "Facebook" },
    { icon: <Instagram size={24} className="text-black" />, label: "Instagram" },
    { icon: <Twitter size={24} className="text-black" />, label: "X" },
    { icon: <Linkedin size={24} className="text-black" />, label: "LinkedIn" },
    { icon: <Youtube size={24} className="text-black" />, label: "YouTube" },
];

const quickLinks = ["Home Page", "About Us", "Shop page", "How it works"];

export function Footer() {
    return (
        <footer className="bg-white py-12 px-4 md:py-[80px] md:px-[64px] font-sans border-t border-[#d0d0d0]">
            <div className="max-w-[1280px] mx-auto">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-12 lg:gap-[128px] w-full mb-12 lg:mb-[80px]">

                    {/* Brand & Description */}
                    <div className="flex flex-col gap-6 w-full lg:w-[500px]">
                        <Link to="/">
                            <img
                                src={imgLogo}
                                alt="Sheps Farm"
                                className="h-10 md:h-[70px] object-contain self-start"
                            />
                        </Link>
                        <p
                            className="font-normal text-base md:text-lg leading-relaxed text-black m-0"
                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                            At Sheps Farm, we believe in real food, raised the right way fresh, halal, and delivered to your door.
                        </p>
                    </div>

                    {/* Container for the columns */}
                    <div className="flex flex-col md:flex-row gap-10 lg:gap-10 w-full lg:w-auto lg:flex-1 lg:justify-end">
                        {/* Quick Links Column */}
                        <div className="flex flex-col gap-4 w-full md:w-[200px]">
                            <h4
                                className="font-semibold text-lg leading-snug text-black m-0"
                                style={{ fontFamily: "'Open Sans', sans-serif" }}
                            >
                                Quick Links
                            </h4>
                            <div className="flex flex-col">
                                {quickLinks.map((l) => (
                                    <a
                                        key={l}
                                        href="#"
                                        className="block py-2 font-normal text-base leading-normal text-black no-underline hover:text-[#12cd80] transition-colors"
                                        style={{ fontFamily: "'Open Sans', sans-serif" }}
                                    >
                                        {l}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Social Media Column */}
                        <div className="flex flex-col gap-4 w-full md:w-[141px]">
                            <h4
                                className="font-semibold text-lg leading-snug text-black m-0"
                                style={{ fontFamily: "'Open Sans', sans-serif" }}
                            >
                                Social Media
                            </h4>
                            <div className="flex flex-col">
                                {socialLinks.map((s) => (
                                    <a
                                        key={s.label}
                                        href="#"
                                        className="flex items-center gap-3 py-2 no-underline hover:opacity-80 transition-opacity"
                                    >
                                        {s.icon}
                                        <span
                                            className="font-normal text-base leading-normal text-black"
                                            style={{ fontFamily: "'Open Sans', sans-serif" }}
                                        >
                                            {s.label}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Divider Line */}
                <div className="w-full h-px bg-[#eef2e3]" />

                {/* Bottom Row */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-6 md:py-[24px] w-full">
                    <p
                        className="font-normal text-sm md:text-base leading-normal text-[#043f2e] m-0 text-center md:text-left"
                        style={{ fontFamily: "'Open Sans', sans-serif" }}
                    >
                        © 2025 Sheps Farm. All rights reserved.
                    </p>
                    <div className="flex flex-wrap justify-center gap-6">
                        <a href="#" className="font-normal text-sm md:text-base leading-normal text-[#043f2e] no-underline hover:text-[#12cd80] transition-colors" style={{ fontFamily: "'Open Sans', sans-serif" }}>Privacy Policy</a>
                        <a href="#" className="font-normal text-sm md:text-base leading-normal text-[#043f2e] no-underline hover:text-[#12cd80] transition-colors" style={{ fontFamily: "'Open Sans', sans-serif" }}>Terms of Service</a>
                        <a href="#" className="font-normal text-sm md:text-base leading-normal text-[#043f2e] no-underline hover:text-[#12cd80] transition-colors" style={{ fontFamily: "'Open Sans', sans-serif" }}>Cookie Policy</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
