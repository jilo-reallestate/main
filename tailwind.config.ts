import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // theme-aware tokens (see globals.css)
        bg: "var(--bg)", surf: "var(--surf)", tx: "var(--tx)", mu: "var(--mu)", ln: "var(--ln)", glass: "var(--glass)", ink: "var(--ink)", ac: "var(--ac)",
        // brand
        gold: { 1: "#F3DDB0", 2: "#C9A66B", 3: "#A88B5B", d: "#7A6238" },
        success: "#1F9D61", warning: "#D99A00", danger: "#E5484D", info: "#3B82F6",
        // legacy tokens still used by the dashboards
        charcoal: { DEFAULT: "#222729", 80: "#3A4043" },
        ivory: { DEFAULT: "#F4F0E8", dark: "#E8E2D5" },
        bronze: { DEFAULT: "#A88B5B", deep: "#7A6238", light: "#C9B38A" },
      },
      borderRadius: { sm: "12px", md: "20px", lg: "28px", xl: "36px", "2xl": "44px" },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-arabic)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "var(--font-arabic)", "system-ui", "sans-serif"],
      },
      keyframes: {
        float: { to: { transform: "translate(8%,-10%) scale(1.15)" } },
        marquee: { to: { transform: "translateX(-50%)" } },
        twinkle: { from: { opacity: ".15" }, to: { opacity: "1" } },
        fadein: { from: { opacity: "0" } },
        pulse2: { from: { opacity: ".7", transform: "scale(.4)" }, to: { opacity: "0", transform: "scale(2.2)" } },
      },
      animation: { float: "float 14s ease-in-out infinite alternate", marquee: "marquee 38s linear infinite", twinkle: "twinkle 3s ease-in-out infinite alternate", fadein: "fadein .2s", pulse2: "pulse2 2.4s ease-out infinite" },
    },
  },
  plugins: [],
};
export default config;
