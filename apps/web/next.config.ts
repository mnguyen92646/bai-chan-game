import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  allowedDevOrigins: ["michaels-mac-mini.tail7c0eb7.ts.net", "100.127.71.35"],
};

export default nextConfig;
