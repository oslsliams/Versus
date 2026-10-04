import type { Metadata } from "next";
import "./globals.css";
import "./upgrade.css";
import "./fantasy.css";
import "./coins.css";
import "./owner.css";
import "./shop.css";
import "./settings.css";
import "./social.css";

export const metadata: Metadata = {
  title: "VERSUS — Compare. Debate. Predict.",
  description: "Your arena for competitor comparisons, free predictions, and community debate.",
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
