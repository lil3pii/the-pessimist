import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0A0A",
          900: "#0E0E0E",
          850: "#121212",
          800: "#171717",
          700: "#242424",
          600: "#343434",
        },
        bone: "#F4F1EA",
        risk: {
          red: "#FF4D3D",
          amber: "#F5A524",
          green: "#53C08A",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-editorial)", "Georgia", "serif"],
      },
      letterSpacing: {
        tightest: "-0.045em",
        widest2: "0.22em",
      },
      animation: {
        "fade-up": "fade-up 650ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 500ms ease both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "scan": "scan 1.8s ease-in-out infinite",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
