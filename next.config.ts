import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs) must load from node_modules at runtime, not be bundled
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "sql.js"],
  // Dashboard tabs were merged; keep old bookmarks and emailed links working.
  async redirects() {
    return [
      { source: "/dashboard/career-path", destination: "/dashboard", permanent: true },
      { source: "/dashboard/skill-gap", destination: "/dashboard/skills?view=gaps", permanent: true },
      { source: "/dashboard/education", destination: "/dashboard/vault", permanent: true },
    ];
  },
  allowedDevOrigins: [
    "localhost",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;