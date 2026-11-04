/** @type {import('tailwindcss').Config} */
// Tema bergaya iOS dengan Dark Mode. Warna dasar adalah CSS variable (app/globals.css)
// sehingga mode terang/gelap cukup menukar nilai variabel.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["-apple-system", "BlinkMacSystemFont", "\"SF Pro Text\"", "Inter", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), mute: v("ink-mute") },
        canvas: v("canvas"),
        surface: v("surface"),
        raised: v("raised"),
        seg: v("seg"),
        switchoff: v("switchoff"),
        line: v("line"),
        rule: v("rule"),
        control: v("control"),
        fill: "rgb(var(--fill) / var(--fill-a))",
        brand: { 50: v("brand-50"), 100: v("brand-50"), 400: "#38BDF8", 500: v("brand"), 600: v("brand"), 700: v("brand"), 900: "#075985" },
        income: { DEFAULT: v("income"), bright: v("income-bright"), soft: v("income-soft"), ink: v("income-ink") },
        expense: { DEFAULT: v("expense"), soft: v("expense-soft"), ink: v("expense-ink") },
        transfer: { DEFAULT: v("indigo"), soft: v("brand-50") },
        warn: { DEFAULT: v("orange"), soft: v("warn-soft"), ink: v("warn-ink"), line: v("warn-soft") },
      },
      borderRadius: { card: "20px", control: "12px", tile: "10px" },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / var(--shadow-a)), 0 6px 20px -12px rgb(0 0 0 / calc(var(--shadow-a) * 3))",
        lift: "0 18px 36px -16px rgba(2,132,199,.5)",
        float: "0 12px 40px -8px rgba(0,0,0,.28)",
        seg: "0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)",
      },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": { from: { opacity: 0, transform: "translateY(8px) scale(.97)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: {
        "sheet-up": "sheet-up .38s cubic-bezier(.32,.72,0,1)",
        "fade-in": "fade-in .2s ease-out",
        "pop-in": "pop-in .26s cubic-bezier(.32,.72,0,1) both",
      },
    },
  },
  plugins: [],
};
