import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "olive-deep": "#3A3F2A",
        olive: "#6B7350",
        rust: "#A8442A",
        "rust-light": "#E0926B",
        bone: "#DDD3C0",
        "bone-light": "#F0EBDF",
        canvas: "#FAF8F3",
        "edge": "#C2B9A3",
        muted: "#7A7259",
        ink: "#2C2A24",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        shell: "1240px",
      },
      letterSpacing: {
        eyebrow: "0.22em",
      },
      boxShadow: {
        panel: "0 24px 60px -28px rgba(44, 42, 36, 0.45)",
        "panel-sm": "0 12px 30px -18px rgba(44, 42, 36, 0.4)",
        glow: "0 0 0 1px rgba(168, 68, 42, 0.18), 0 18px 50px -22px rgba(168, 68, 42, 0.4)",
      },
      keyframes: {
        "thread-pulse": {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-24" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        "thread-pulse": "thread-pulse 1.1s linear infinite",
        shimmer: "shimmer 2.4s ease-in-out infinite",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
