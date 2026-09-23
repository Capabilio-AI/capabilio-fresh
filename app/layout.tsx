import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capabilio AI — Your Career Needs More Than a Resume",
  description:
    "Capabilio AI is an AI Career Operating System. Build skills, practice on real challenges, and turn your work into verified career evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-lp-background text-lp-text-ink antialiased">{children}</body>
    </html>
  );
}
