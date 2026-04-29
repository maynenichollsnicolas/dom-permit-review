import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    let renderUrl = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    // Ensure protocol prefix and strip trailing slash
    if (renderUrl && !renderUrl.startsWith("http")) {
      renderUrl = `https://${renderUrl}`;
    }
    renderUrl = renderUrl.replace(/\/$/, "");
    const rule = {
      source: "/api/v1/:path*",
      destination: `${renderUrl}/api/v1/:path*`,
    };
    return { beforeFiles: [rule], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
