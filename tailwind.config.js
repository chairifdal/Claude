/** @type {import('tailwindcss').Config} */
// Tokens dari taste-skill (app style: pastel-consumer, seed 1947618770)
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Manrope", "Inter", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#1b1d1f", soft: "#5c6064", mute: "#6b6b6b" },
        canvas: "#f3f5f7",
        raised: "#f2f8fd",
        line: "#e6e6e6",
        rule: "#f4f4f4",
        control: "#d6d9dd",
        brand: { 50: "#dcf1ff", 100: "#dcf1ff", 400: "#1d5fd6", 500: "#1d5fd6", 600: "#1d5fd6", 700: "#0a3a80", 900: "#0a3a80" },
        income: { DEFAULT: "#2f7a45", soft: "#dcfae5", ink: "#04250e" },
        expense: { DEFAULT: "#c41c29", soft: "#ffedea", ink: "#831c1e" },
        transfer: { DEFAULT: "#0a3a80", soft: "#dcf1ff" },
        warn: { soft: "#fffbeb", ink: "#92400e", line: "#fde68a" },
      },
      borderRadius: { card: "20px", control: "10px" },
      boxShadow: {
        float: "0 12px 32px -8px rgba(27,29,31,.18)",
      },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: {
        "sheet-up": "sheet-up .28s cubic-bezier(.2,.9,.3,1)",
        "fade-in": "fade-in .18s ease-out",
        "pop-in": "pop-in .22s cubic-bezier(.2,.9,.3,1) both",
      },
    },
  },
  plugins: [],
};
