import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs) must load from node_modules at runtime, not be bundled
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "sql.js", "@electric-sql/pglite"],
  // pdfjs loads @napi-rs/canvas (DOMMatrix) through a dynamic require the file tracer cannot see; without it the PDF routes
  // crash on Vercel with "DOMMatrix is not defined". Ship the package and its platform binary with those routes.
  // It also imports its worker (legacy/build/pdf.worker.mjs) dynamically; without that file every read fails with "Setting up fake worker failed".
  outputFileTracingIncludes: {
    "/api/admin/curriculum/extractions": ["./node_modules/@napi-rs/canvas*/**/*", "./node_modules/pdfjs-dist/legacy/build/**/*"],
    "/api/graduate/resume": ["./node_modules/@napi-rs/canvas*/**/*", "./node_modules/pdfjs-dist/legacy/build/**/*"],
    // the SQL workspace runs queries in workers that load sql.js and PGlite (plus its starting snapshot) from disk, which the tracer cannot see
    "/api/arena/domain/**/*": ["./node_modules/sql.js/dist/**/*", "./node_modules/@electric-sql/pglite/dist/**/*", "./lib/workplace/sql/assets/*"],
  },
  // Dashboard tabs were merged; keep old bookmarks and emailed links working.
  async redirects() {
    return [
      { source: "/dashboard/career-path", destination: "/dashboard", permanent: true },
      { source: "/dashboard/skill-gap", destination: "/dashboard/skills?view=gaps", permanent: true },
      { source: "/dashboard/education", destination: "/dashboard/vault", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
  allowedDevOrigins: [
    "localhost",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;