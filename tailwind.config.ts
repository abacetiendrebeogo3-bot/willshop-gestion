import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#F8F5EE", // Warm off-white / cream background
        foreground: "#1F1917", // High contrast dark text
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F1917",
        },
        border: "#EBE5DA",
        bordeaux: {
          DEFAULT: "#800020", // WILLShop Bordeaux Profond
          hover: "#590C1D",
          light: "#F5E6E9",
          foreground: "#FFFFFF",
        },
        gold: {
          DEFAULT: "#D4A843", // WILLShop Or Accent
          hover: "#B08426",
          light: "#FDF8EB",
          foreground: "#1F1917",
        },
        ink: {
          DEFAULT: "#1F1917",
          muted: "#6B625B",
          light: "#A0958C",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(31, 25, 23, 0.03)",
        xs: "0 2px 8px 0 rgba(31, 25, 23, 0.04)",
        sm: "0 4px 16px 0 rgba(31, 25, 23, 0.06)",
        md: "0 8px 24px 0 rgba(31, 25, 23, 0.08)",
        lg: "0 12px 32px 0 rgba(31, 25, 23, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
