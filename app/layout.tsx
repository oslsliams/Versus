import type { Metadata } from "next";
import "./globals.css";
import "./upgrade.css";
import "./fantasy.css";
import "./coins.css";
import "./owner.css";
import "./shop.css";
import "./settings.css";
import "./social.css";
import "./moments.css";
import "./polish.css";
import "./archive.css";
import "./qol.css";
import "./bubble.css";
import "./bubble-home.css";
import "./bubble-pages.css";
import "./bubble-features.css";
import "./bubble-account.css";

export const metadata: Metadata = {
  title: "VERSUS — The UFC Fighter Archive",
  description: "Explore UFC fighter careers, compare statistics, collect iconic Moments, and draft your fantasy fight team.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
