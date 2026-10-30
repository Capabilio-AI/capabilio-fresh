import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Capabilio AI — The Career Operating System Where Proof Beats Resume",
  description:
    "Capabilio AI is the career operating system for India and the rest of the world. Build skills, practice on real challenges, and carry a Skill Passport anyone can verify.",
  // Transparent "C." mark: dark letter on light browser chrome, white on dark chrome
  icons: {
    icon: [
      {
        url: "/brand/icon-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/icon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/brand/icon-light.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-lp-background text-lp-text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}