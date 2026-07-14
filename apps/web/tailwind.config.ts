import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
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
        edge: "#C2B9A3",
        muted: "#7A7259",
        ink: "#2C2A24",
        // status accents
        live: "#5C8A3A",
        warn: "#C9892F",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      boxShadow: {
        panel: "0 24px 60px -28px rgba(44, 42, 36, 0.45)",
        "panel-sm": "0 12px 30px -18px rgba(44, 42, 36, 0.4)",
        card: "0 1px 0 0 rgba(194,185,163,0.4), 0 18px 40px -30px rgba(44,42,36,0.35)",
        glow: "0 0 0 1px rgba(168, 68, 42, 0.2), 0 18px 50px -22px rgba(168, 68, 42, 0.4)",
      },
      keyframes: {
        blink: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.25" } },
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "70%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "bar-eq": {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        blink: "blink 1.4s ease-in-out infinite",
        "ping-soft": "ping-soft 2s ease-out infinite",
        shimmer: "shimmer 2.4s ease-in-out infinite",
        "bar-eq": "bar-eq 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
