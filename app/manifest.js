export default function manifest() {
  return {
    name: "Kantong Kita",
    short_name: "Kantong",
    description: "Catat keuangan berdua, real-time.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#1d5fd6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
