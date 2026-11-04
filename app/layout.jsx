import "./globals.css";
import Providers from "@/components/Providers";


export const metadata = {
  title: "Kantong Kita",
  description: "Catat keuangan berdua: akun bersama, transfer antar pasangan, real-time.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kantong Kita", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F2F2F7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        {/* iPhone memakai SF Pro (font sistem); Android/desktop memakai Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans"><Providers>{children}</Providers></body>
    </html>
  );
}
