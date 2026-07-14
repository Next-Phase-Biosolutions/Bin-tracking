import type { Metadata, Viewport } from "next";
import { Archivo, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nextphasebiosolutions.com"),
  title: "Next Phase BioSolutions | The operating system for zero waste meat processing",
  description:
    "Next Phase BioSolutions brings the whole plant online with sensors, cameras, and voice, turns raw capture into decisions with AI, seals every record on a blockchain, and turns waste into byproduct sales and verified carbon credits. Nothing wasted. One source of truth.",
  keywords: [
    "meat processing software",
    "slaughterhouse technology",
    "yield recovery",
    "HACCP compliance",
    "CFIA",
    "OMAFRA",
    "carbon credits",
    "byproduct recovery",
    "five gas sensor",
  ],
  openGraph: {
    title: "Next Phase BioSolutions",
    description:
      "The operating system for zero waste meat processing. Nothing wasted. One source of truth.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3A3F2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
