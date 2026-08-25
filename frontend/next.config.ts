import type { NextConfig } from "next";

const API_ORIGIN = (process.env.API_ORIGIN || "http://127.0.0.1:7860").replace(/\/$/, "");

function shouldProxyApi() {
  if (!API_ORIGIN) return false;
  const vercel = process.env.VERCEL_URL || "";
  if (vercel && API_ORIGIN.includes(vercel)) return false;
  if (process.env.VERCEL && API_ORIGIN.includes("127.0.0.1")) return false;
  return true;
}

const nextConfig: NextConfig = {
  async rewrites() {
    if (!shouldProxyApi()) return [];
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
