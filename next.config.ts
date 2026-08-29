import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["@vercel/blob"],
  },
};

export default nextConfig;
