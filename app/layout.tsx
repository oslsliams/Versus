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
      <body className="antialiased">{children}</body>
    </html>
  );
}
