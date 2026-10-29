import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack resolves packages (e.g. tailwindcss) from this folder's node_modules.
  turbopack: { root: __dirname },
};

export default nextConfig;
