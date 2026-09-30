import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;