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
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        border: "var(--border)",
        primary: {
          DEFAULT: "#800020", // WILLShop Bordeaux Profond
          hover: "#660019",
          foreground: "#FFFFFF",
        },
        gold: {
          DEFAULT: "#D4A843", // WILLShop Or Officiel
          hover: "#B88E30",
          foreground: "#111827",
        },
        bordeaux: {
          DEFAULT: "#800020",
          hover: "#660019",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#D4A843", // WILLShop Gold Accent
          foreground: "#111827",
        },
        sidebar: {
          DEFAULT: "#0F172A",
          foreground: "#94A3B8",
          active: "#1E293B",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
