import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: true,
  eslint: {
    // Allow builds to succeed even if dev linting fails; keep CI lint strict.
    ignoreDuringBuilds: true,
  },
  images: {
    // TMDB image host used by the app
    domains: ["image.tmdb.org"],
  },
  experimental: {
    // keep App Router behaviors stable; enable any necessary experiments here
  },
};

export default nextConfig;
