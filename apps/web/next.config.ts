import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    let railwayUrl = process.env.RAILWAY_API_URL || "http://localhost:8000";
    // Ensure protocol prefix and strip trailing slash
    if (railwayUrl && !railwayUrl.startsWith("http")) {
      railwayUrl = `https://${railwayUrl}`;
    }
    railwayUrl = railwayUrl.replace(/\/$/, "");
    const rule = {
      source: "/api/v1/:path*",
      destination: `${railwayUrl}/api/v1/:path*`,
    };
    return { beforeFiles: [rule], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
