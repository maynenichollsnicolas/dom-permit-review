import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    let railwayUrl = process.env.RAILWAY_API_URL || "http://localhost:8000";
    // Ensure protocol prefix and strip trailing slash
    if (railwayUrl && !railwayUrl.startsWith("http")) {
      railwayUrl = `https://${railwayUrl}`;
    }
    railwayUrl = railwayUrl.replace(/\/$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${railwayUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
