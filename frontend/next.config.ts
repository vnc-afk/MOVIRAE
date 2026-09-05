import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: true,
  images: {
    // TMDB image host used by the app
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
  experimental: {
    // keep App Router behaviors stable; enable any necessary experiments here
  },
};

export default nextConfig;
