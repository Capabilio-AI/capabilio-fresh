import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs) must load from node_modules at runtime, not be bundled
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "sql.js"],
  allowedDevOrigins: [
    "localhost",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;