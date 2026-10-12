import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0b10",
        foreground: "#f4f4f7",
        clay: {
          sunken: "#0d0e15",
          base: "#13151f",
          elevated: "#181b28",
          highlight: "#202434",
          border: "rgba(255, 255, 255, 0.05)",
        },
        surface: {
          50: "#181b28",
          100: "#13151f",
          200: "#0e0f17",
          300: "#0a0b10",
          border: "#1c1f2e",
          highlight: "#262b3e",
        },
        brand: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b", // Core warm electric amber
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        accent: {
          cyan: "#00d2d3",
          emerald: "#10b981",
          crimson: "#ef4444",
          silver: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
      },
      boxShadow: {
        "clay-card":
          "inset 1px 1px 2px rgba(255, 255, 255, 0.07), inset -2px -2px 5px rgba(0, 0, 0, 0.5), 0 10px 25px -4px rgba(0, 0, 0, 0.55)",
        "clay-elevated":
          "inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.1), inset -3px -3px 6px rgba(0, 0, 0, 0.6), 0 20px 40px -8px rgba(0, 0, 0, 0.65)",
        "clay-btn-primary":
          "inset 1px 2px 2px rgba(255, 255, 255, 0.4), inset -1.5px -2px 3px rgba(0, 0, 0, 0.25), 0 8px 20px -2px rgba(217, 119, 6, 0.35)",
        "clay-btn-secondary":
          "inset 1px 1px 2px rgba(255, 255, 255, 0.08), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.45), 0 6px 16px -2px rgba(0, 0, 0, 0.4)",
        "clay-input":
          "inset 2px 2px 5px rgba(0, 0, 0, 0.65), inset -1px -1px 2px rgba(255, 255, 255, 0.03)",
        "clay-pill":
          "inset 1px 1px 2px rgba(255, 255, 255, 0.08), inset -1px -1px 2px rgba(0, 0, 0, 0.4), 0 4px 10px rgba(0, 0, 0, 0.35)",
        glow: "0 0 25px -5px rgba(245, 158, 11, 0.3)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
export default config;
