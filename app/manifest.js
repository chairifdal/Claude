export default function manifest() {
  return {
    name: "Finance Tracker",
    short_name: "Finance",
    description: "Catat keuangan berdua, real-time.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F2F7",
    theme_color: "#1E40AF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
