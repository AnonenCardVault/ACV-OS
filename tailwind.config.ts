import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        acv: {
          black: "#050507",
          panel: "#0c0d11",
          panel2: "#12141b",
          border: "#252837",
          purple: "#8b3ffc",
          gold: "#f2b84b",
          teal: "#26d4c7",
          green: "#38d980",
          pink: "#ff4f8b",
          red: "#ff5c66",
          text: "#f4f0ff",
          muted: "#9da3b8"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,63,252,0.28), 0 18px 80px rgba(0,0,0,0.45)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};

export default config;
