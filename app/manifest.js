export default function manifest() {
  return {
    name: "Kantong Kita",
    short_name: "Kantong",
    description: "Catat keuangan berdua, real-time.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F5FA",
    theme_color: "#2440DE",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
