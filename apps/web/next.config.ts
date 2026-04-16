import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const railwayUrl =
      process.env.RAILWAY_API_URL ||
      "http://localhost:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${railwayUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
