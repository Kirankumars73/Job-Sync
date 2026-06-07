import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Three.js to be bundled without issues
  transpilePackages: ["three"],
  // Empty turbopack config to silence the warning (no custom config needed)
  turbopack: {},
};

export default nextConfig;
