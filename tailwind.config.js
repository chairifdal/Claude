/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#0E1430", soft: "#4B5373", mute: "#8A91AB" },
        canvas: "#F3F5FA",
        line: "#E6E9F2",
        brand: { 50: "#EEF1FF", 100: "#DDE3FF", 400: "#5B74FF", 500: "#3654F5", 600: "#2440DE", 700: "#1B31B4", 900: "#111C5C" },
        income: { DEFAULT: "#0F9F6E", soft: "#E3F7EF" },
        expense: { DEFAULT: "#E5484D", soft: "#FDECEC" },
        transfer: { DEFAULT: "#3654F5", soft: "#EEF1FF" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,20,48,.04), 0 8px 24px -12px rgba(14,20,48,.12)",
        lift: "0 20px 40px -18px rgba(36,64,222,.55)",
        sheet: "0 -12px 40px -12px rgba(14,20,48,.25)",
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": { from: { opacity: 0, transform: "translateY(12px) scale(.96)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: {
        "sheet-up": "sheet-up .32s cubic-bezier(.2,.9,.3,1)",
        "fade-in": "fade-in .2s ease-out",
        "pop-in": "pop-in .28s cubic-bezier(.2,.9,.3,1) both",
      },
    },
  },
  plugins: [],
};
