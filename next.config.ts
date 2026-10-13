import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs) must load from node_modules at runtime, not be bundled
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "sql.js"],
  // pdfjs loads @napi-rs/canvas (DOMMatrix) through a dynamic require the file tracer cannot see; without it the PDF routes
  // crash on Vercel with "DOMMatrix is not defined". Ship the package and its platform binary with those routes.
  outputFileTracingIncludes: {
    "/api/admin/curriculum/extractions": ["./node_modules/@napi-rs/canvas*/**/*"],
    "/api/graduate/resume": ["./node_modules/@napi-rs/canvas*/**/*"],
  },
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