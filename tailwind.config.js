/** @type {import('tailwindcss').Config} */
// Tema bergaya iOS: warna sistem Apple, latar grouped #F2F2F7, sudut membulat, blur.
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["-apple-system", "BlinkMacSystemFont", "\"SF Pro Text\"", "Inter", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#000000", soft: "#6C6C70", mute: "#8E8E93" },
        canvas: "#F2F2F7",
        raised: "#F7F7FA",
        line: "#E5E5EA",
        rule: "#EFEFF4",
        control: "#D1D1D6",
        fill: "rgba(118,118,128,0.12)",
        brand: { 50: "#E5F1FF", 100: "#D6E9FF", 400: "#409CFF", 500: "#0A84FF", 600: "#007AFF", 700: "#0062CC", 900: "#003E80" },
        income: { DEFAULT: "#248A3D", bright: "#34C759", soft: "#E3F9E8", ink: "#0B4D1D" },
        expense: { DEFAULT: "#FF3B30", soft: "#FFE5E3", ink: "#8E1A13" },
        transfer: { DEFAULT: "#5856D6", soft: "#ECECFB" },
        warn: { DEFAULT: "#FF9500", soft: "#FFF4E0", ink: "#A05A00", line: "#FFD699" },
        ios: { purple: "#AF52DE", pink: "#FF2D55", teal: "#30B0C7", indigo: "#5856D6", orange: "#FF9500", yellow: "#FFCC00", mint: "#00C7BE" },
      },
      borderRadius: { card: "20px", control: "12px", tile: "10px" },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.12)",
        lift: "0 18px 36px -16px rgba(0,98,204,.55)",
        float: "0 12px 40px -8px rgba(0,0,0,.22)",
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
