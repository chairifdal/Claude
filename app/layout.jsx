import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700", "800"] });

export const metadata = {
  title: "Kantong Kita",
  description: "Catat keuangan berdua — akun bersama, transfer antar pasangan, real-time.",
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
  themeColor: "#F3F5FA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={font.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
